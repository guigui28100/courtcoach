import { INestApplication } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import { createHmac } from "crypto";
import { Role } from "@prisma/client";
import { createApp } from "../src/app.factory";
import { PrismaService } from "../src/prisma/prisma.service";
import { stepNow, unseal } from "../src/auth/totp";

process.env.NODE_ENV = "test";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123456";
const ORIGIN = { Origin: "http://localhost:5173" };
const PASSWORD = "un-mot-de-passe-solide-1";

// Calcule le code à 6 chiffres comme le fait l'application du téléphone (pour le test)
function code(secretB32: string, step = stepNow()) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, v = 0; const key: number[] = [];
  for (const c of secretB32) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { key.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0); msg.writeUInt32BE(step >>> 0, 4);
  const h = createHmac("sha1", Buffer.from(key)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

describe("Sécurité : double authentification, mots de passe, journal", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let guardId: string, playerId: string, recovery: string[];
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT); guardId = await login("parent", Role.GUARDIAN);
    playerId = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    await prisma.playerAccess.create({ data: { userId: guardId, playerId, relation: "parent" } });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("mots de passe trop faciles refusés (inscription et changement)", async () => {
    for (const password of ["motdepasse123", "aaaaaaaaaaaa", "1234567890"]) await agent().post("/api/auth/signup").set(ORIGIN).send({ email: "faible@exemple.fr", password, acceptPolicy: true }).expect(400);
    await agent().post("/api/auth/signup").set(ORIGIN).send({ email: "tom.dupont@exemple.fr", password: "tomdupont-2026", acceptPolicy: true }).expect(400); // contient l'e-mail
    await agent().post("/api/auth/signup").set(ORIGIN).send({ email: "ok@exemple.fr", password: "une phrase originale 42", acceptPolicy: true }).expect(201);
  });

  it("le cookie de connexion est en mode strict et les réponses ne sont jamais mises en cache", async () => {
    const r = await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD }).expect(200);
    expect((r.headers["set-cookie"] as unknown as string[]).every((c) => /SameSite=Strict/i.test(c) && /HttpOnly/i.test(c))).toBe(true);
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("double authentification du coach : activation, code obligatoire, un code ne sert qu'une fois, codes de secours", async () => {
    await A.adulte.post("/api/auth/2fa/setup").set(ORIGIN).expect(403);
    await A.parent.post("/api/auth/2fa/setup").set(ORIGIN).expect(403);
    const s = (await A.coach.post("/api/auth/2fa/setup").set(ORIGIN).expect(200)).body;
    expect(s.otpauth).toContain("otpauth://totp/"); expect(s.secret).toMatch(/^[A-Z2-7]{32}$/);
    const stored = (await prisma.user.findUniqueOrThrow({ where: { email: "coach@exemple.fr" } })).totpSecret!;
    expect(stored).not.toContain(s.secret); expect(unseal(stored)).toBe(s.secret); // chiffrée dans la base
    await A.coach.post("/api/auth/2fa/enable").set(ORIGIN).send({ code: "000000" }).expect(400);
    const en = (await A.coach.post("/api/auth/2fa/enable").set(ORIGIN).send({ code: code(s.secret) }).expect(200)).body; recovery = en.recoveryCodes; expect(recovery).toHaveLength(8);
    expect((await A.coach.get("/api/auth/me").expect(200)).body.twoFactor).toBe(true);
    // connexion : mot de passe seul → refusé et on demande le code
    const c1 = await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD }).expect(401); expect(c1.body.code).toBe("TOTP_REQUIRED");
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD, code: "123456" }).expect(401);
    // le code utilisé à l'activation ne peut pas resservir ; le suivant (période suivante) est accepté une fois
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD, code: code(s.secret) }).expect(401);
    const next = code(s.secret, stepNow() + 1);
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD, code: next }).expect(200);
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD, code: next }).expect(401);
    // code de secours : une seule fois
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD, code: recovery[0] }).expect(200);
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD, code: recovery[0] }).expect(401);
    // les autres comptes ne sont pas concernés
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "adulte@exemple.fr", password: PASSWORD }).expect(200);
    // désactivation : mot de passe + code valide d'une période encore jamais utilisée
    await A.coach.post("/api/auth/2fa/disable").set(ORIGIN).send({ password: "mauvais-mot-de-passe", code: code(s.secret, stepNow() + 1) }).expect(401);
    await prisma.user.update({ where: { email: "coach@exemple.fr" }, data: { totpLastStep: stepNow() - 5 } });
    await A.coach.post("/api/auth/2fa/disable").set(ORIGIN).send({ password: PASSWORD, code: code(s.secret) }).expect(204);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "coach@exemple.fr" } })).totpSecret).toBeNull();
  });

  it("les échecs et les blocages de connexion sont écrits dans le journal", async () => {
    for (let i = 0; i < 5; i++) await agent().post("/api/auth/login").set(ORIGIN).send({ email: "adulte@exemple.fr", password: "faux-faux-faux" }).expect(401);
    const actions = (await prisma.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
    expect(actions).toContain("login-failed"); expect(actions).toContain("login-locked");
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "adulte@exemple.fr", password: PASSWORD }).expect(401); // bloqué 15 minutes même avec le bon mot de passe
    await prisma.user.update({ where: { email: "adulte@exemple.fr" }, data: { lockedUntil: null, failedLogins: 0 } });
  });

  it("mot de passe oublié d'un parent : le coach en donne un provisoire (sessions fermées) ; personne d'autre ne peut", async () => {
    await A.parent.post(`/api/players/${playerId}/access/${guardId}/reset-password`).set(ORIGIN).expect(403);
    await A.adulte.post(`/api/players/${playerId}/access/${guardId}/reset-password`).set(ORIGIN).expect(403);
    await A.coach.post(`/api/players/${playerId}/access/inconnu/reset-password`).set(ORIGIN).expect(404);
    const r = (await A.coach.post(`/api/players/${playerId}/access/${guardId}/reset-password`).set(ORIGIN).expect(200)).body;
    expect(r.temporaryPassword).toHaveLength(14);
    await A.parent.get("/api/players").expect(403); // l'ancienne session ne sert plus qu'à changer le mot de passe
    const again = agent(); await again.post("/api/auth/login").set(ORIGIN).send({ email: "parent@exemple.fr", password: PASSWORD }).expect(401);
    await again.post("/api/auth/login").set(ORIGIN).send({ email: "parent@exemple.fr", password: r.temporaryPassword }).expect(200);
    expect((await again.get("/api/auth/me").expect(200)).body.mustChangePassword).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "reset-password" } })).toBe(1);
  });

  it("le journal garde la trace des ouvertures de fiche par le coach ; le compte du coach ne peut pas être supprimé depuis le site", async () => {
    await A.coach.get(`/api/players/${playerId}`).expect(200);
    expect(await prisma.auditLog.count({ where: { action: "read", entityId: playerId } })).toBeGreaterThan(0);
    await A.coach.delete("/api/auth/me").set(ORIGIN).expect(403);
  });
});
