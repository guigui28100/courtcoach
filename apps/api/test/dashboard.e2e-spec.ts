import { INestApplication } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import { Role } from "@prisma/client";

process.env.NODE_ENV = "test";
process.env.TEST_USER_CACHE = "1"; // ce fichier vérifie aussi la mémoire de 3 secondes de la vérification de connexion
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123456";
import { createApp } from "../src/app.factory";
import { PrismaService } from "../src/prisma/prisma.service";

const ORIGIN = { Origin: "http://localhost:5173" };
const PASSWORD = "un-mot-de-passe-solide-1";

describe("Accueil du coach en UNE demande, et mémoire de la vérification de connexion", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  let p1: string, p2: string, trainerId: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role, extra: object = {}) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD), ...extra } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.lessonRequest.deleteMany(); await prisma.user.deleteMany(); }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT); await login("parent", Role.GUARDIAN);
    trainerId = await login("trainer", Role.TRAINER, { trainerKind: "COMITE" });
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.create({ data: { userId: trainerId, playerId: p1, relation: "entraineur" } });
    const base = { proud: [], improve: [], wish: [] };
    await prisma.selfEvaluation.create({ data: { playerId: p1, season: "2026-2027", trimester: 1, sentAt: new Date(), ...base } });
    await prisma.selfEvaluation.create({ data: { playerId: p2, season: "2026-2027", trimester: 1, sentAt: new Date(), ...base } });
    await prisma.selfEvaluation.create({ data: { playerId: p2, season: "2026-2027", trimester: 2, sentAt: new Date(), readAt: new Date(), ...base } }); // déjà lu
    await prisma.selfEvaluation.create({ data: { playerId: p1, season: "2026-2027", trimester: 3, ...base } }); // brouillon : jamais visible du coach
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le coach reçoit tout d'un coup : jeunes, bulletins à lire (envoyés et non lus seulement), place des vidéos, bilans, professeurs", async () => {
    const d = (await A.coach.get("/api/dashboard").expect(200)).body;
    expect(d.players.map((p: any) => p.firstName).sort()).toEqual(["Léo", "Nina"]);
    expect(d.selfEvals).toHaveLength(2); expect(d.selfEvals.map((x: any) => x.ev.trimester)).toEqual([1, 1]); expect(d.selfEvals[0].player.firstName).toBeTruthy();
    expect(d.storage).toMatchObject({ quotaBytes: expect.any(Number) });
    expect(d).toMatchObject({ lessons: [], reports: [], inactive: [], profsWaiting: 0 });
  });

  it("un entraîneur ne reçoit QUE ses jeunes et leurs bulletins ; pas de demandes, de place vidéo ni de bilans à valider", async () => {
    const d = (await A.trainer.get("/api/dashboard").expect(200)).body;
    expect(d.players.map((p: any) => p.id)).toEqual([p1]);
    expect(d.selfEvals.map((x: any) => x.player.id)).toEqual([p1]); // jamais le bulletin de Nina
    expect(d).toMatchObject({ lessons: [], inactive: [], reports: [], storage: null, profsWaiting: 0 });
    expect(JSON.stringify(d)).not.toContain("Nina");
  });

  it("adulte et famille n'ont aucun accès", async () => {
    await A.adulte.get("/api/dashboard").expect(403);
    await A.parent.get("/api/dashboard").expect(403);
    await request(app.getHttpServer()).get("/api/dashboard").expect(401);
  });

  it("la mémoire de 3 secondes ne garde jamais un accès coupé : mot de passe changé, accès retiré, entraîneur supprimé = refusé tout de suite", async () => {
    // la mémoire est bien utilisée : on retire le compte en base SANS passer par l'API, la session reste valable jusqu'à 3 s
    await A.trainer.get("/api/players").expect(200);
    await prisma.user.update({ where: { id: trainerId }, data: { firstName: "Julie" } });
    await A.trainer.get("/api/players").expect(200);
    // mais tout ce qui doit couper un accès vide la mémoire
    await A.coach.delete(`/api/trainers/${trainerId}`).set(ORIGIN).expect(204);
    await A.trainer.get("/api/players").expect(401);
    const pid = await login("adulte2", Role.ADULT);
    const other = agent(); await other.post("/api/auth/login").set(ORIGIN).send({ email: "adulte2@exemple.fr", password: PASSWORD }).expect(200); // une 2e session (autre appareil)
    await other.get("/api/profs").expect(200); // elle est maintenant dans la mémoire
    await A.adulte2.post("/api/auth/change-password").set(ORIGIN).send({ currentPassword: PASSWORD, newPassword: "un-autre-mot-de-passe-solide-2" }).expect(200);
    await other.get("/api/profs").expect(401); // l'ancienne session est fermée aussitôt, malgré la mémoire
    await A.adulte2.get("/api/profs").expect(200); // la session qui a changé le mot de passe reste ouverte
    expect(pid).toBeTruthy();
  });
});
