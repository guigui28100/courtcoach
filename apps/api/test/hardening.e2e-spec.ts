import { INestApplication } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import { createHmac } from "crypto";
import { Role } from "@prisma/client";
import { createApp } from "../src/app.factory";
import { PrismaService } from "../src/prisma/prisma.service";
import { newSecret, seal, stepNow, unsealWithKey } from "../src/auth/totp";

process.env.NODE_ENV = "test";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123456";
const ORIGIN = { Origin: "http://localhost:5173" };
const PASSWORD = "un-mot-de-passe-solide-1";

// Code à 6 chiffres comme celui de l'application du téléphone
function code(secretB32: string, step = stepNow()) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, v = 0; const key: number[] = [];
  for (const c of secretB32) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { key.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0); msg.writeUInt32BE(step >>> 0, 4);
  const h = createHmac("sha1", Buffer.from(key)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

describe("Durcissement : inscriptions, place des adultes, clé de la double authentification", () => {
  let app: INestApplication; let prisma: PrismaService;
  const agent = () => request.agent(app.getHttpServer());
  const saved = { ...process.env };
  async function clean() { await prisma.video.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  const signup = (n: number) => agent().post("/api/auth/signup").set(ORIGIN).send({ email: `adulte${n}@exemple.fr`, password: PASSWORD + n, acceptPolicy: true });

  beforeAll(async () => { app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean(); });
  afterAll(async () => { process.env = { ...saved }; await clean(); await app.close(); });
  afterEach(() => { for (const k of ["SIGNUP_PER_HOUR", "ADULT_QUOTA_MB", "ADULT_SHARE_PERCENT", "VIDEO_QUOTA_MB", "TOTP_KEY", "JWT_SECRET_OLD"]) delete process.env[k]; process.env.JWT_SECRET = saved.JWT_SECRET; });

  it("inscription adulte : la limite par heure est commune à tous les serveurs (comptée dans la base)", async () => {
    process.env.SIGNUP_PER_HOUR = "3";
    for (let i = 1; i <= 3; i++) await signup(i).expect(201);
    const r = await signup(4).expect(429);
    expect(r.body.message).toMatch(/inscriptions/);
    expect(await prisma.user.count({ where: { email: "adulte4@exemple.fr" } })).toBe(0);
    process.env.SIGNUP_PER_HOUR = "50"; await signup(4).expect(201); // la limite se règle
  });

  it("un adulte ne peut pas remplir le stockage du club : place limitée par adulte et pour tous les adultes ensemble, le coach garde la sienne", async () => {
    await clean();
    const sign = async (key: string) => { const a = agent(); await a.post("/api/auth/signup").set(ORIGIN).send({ email: `${key}@exemple.fr`, password: PASSWORD, acceptPolicy: true }).expect(201); return a; };
    const announce = (who: ReturnType<typeof agent>, kb: number, extra: object = {}) => who.post("/api/videos").set(ORIGIN).send({ title: "Mon service", shot: "Service", sizeBytes: kb * 1024, ...extra });
    process.env.VIDEO_QUOTA_MB = "10"; process.env.ADULT_QUOTA_MB = "1"; process.env.ADULT_SHARE_PERCENT = "15"; // 1 Mo par adulte, 1,5 Mo pour tous les adultes
    const a = await sign("a"), b = await sign("b");
    await announce(a, 600).expect(201);
    const full = await announce(a, 600).expect(400); // 1,2 Mo > 1 Mo : sa place est pleine
    expect(full.body.message).toMatch(/place de stockage/);
    await announce(b, 600).expect(201); // 1,2 Mo au total : encore de la place pour les adultes
    const shared = await announce(b, 600).expect(400); // sa place à lui : 1,2 Mo > 1 Mo
    expect(shared.body.message).toMatch(/place de stockage/);
    const c = await sign("c");
    const sharedFull = await announce(c, 400).expect(507); // 1,2 + 0,4 Mo > 1,5 Mo : la part des adultes est pleine
    expect(sharedFull.body.message).toMatch(/réservée aux vidéos d'adultes/);
    // le coach (et les jeunes) gardent leur place : il reste de la place hors part des adultes
    await prisma.user.create({ data: { email: "coach@exemple.fr", role: Role.COACH, passwordHash: await hash(PASSWORD) } });
    const coach = agent(); await coach.post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD }).expect(200);
    const p = (await coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    await coach.post(`/api/players/${p}/consents`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "Parent", method: "paper" }).expect(201);
    await announce(coach, 3000, { playerId: p }).expect(201);
  });

  it("clé de la double authentification : régler TOTP_KEY plus tard ne casse rien, la clé est rechiffrée, et changer JWT_SECRET ensuite non plus", async () => {
    await clean();
    const secret = newSecret();
    const email = "coach@exemple.fr";
    const u = await prisma.user.create({ data: { email, role: Role.COACH, passwordHash: await hash(PASSWORD), totpEnabled: true, totpSecret: seal(secret), recoveryCodes: [] } }); // ancien réglage : chiffré avec JWT_SECRET
    const me = async (a: ReturnType<typeof agent>) => (await a.get("/api/auth/me").expect(200)).body;
    const a1 = agent(); await a1.post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD, code: code(secret) }).expect(200);
    expect((await me(a1)).totpKeyShared).toBe(true); // avertissement affiché au coach : la clé dépend encore de JWT_SECRET
    // le coach règle TOTP_KEY : sa double authentification marche toujours (ancienne clé acceptée) et le secret est rechiffré
    process.env.TOTP_KEY = "une-longue-phrase-secrete-au-hasard-pour-les-tests-0123456789";
    const a2 = agent(); await a2.post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD, code: code(secret, stepNow() + 1) }).expect(200);
    expect("totpKeyShared" in (await me(a2))).toBe(false);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(unsealWithKey(row.totpSecret!)).toEqual({ plain: secret, old: false });
    // JWT_SECRET change ensuite (rotation annuelle) : la double authentification n'est plus touchée
    process.env.JWT_SECRET = "un-tout-autre-secret-de-connexion-pour-le-test-123456789";
    expect(unsealWithKey(row.totpSecret!).plain).toBe(secret);
  });

  it("changer JWT_SECRET sans TOTP_KEY : JWT_SECRET_OLD permet de rouvrir l'ancienne clé", () => {
    const sealed = seal("ABCDEFGH"); // chiffré avec le JWT_SECRET actuel
    const oldSecret = process.env.JWT_SECRET!;
    process.env.JWT_SECRET = "nouveau-secret-de-connexion-pour-ce-test-0123456789";
    expect(() => unsealWithKey(sealed)).toThrow(); // sans aide, impossible
    process.env.JWT_SECRET_OLD = oldSecret;
    expect(unsealWithKey(sealed)).toEqual({ plain: "ABCDEFGH", old: true });
  });
});
