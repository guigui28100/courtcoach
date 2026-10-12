import { INestApplication } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app.factory";
import { PrismaService } from "../src/prisma/prisma.service";

process.env.NODE_ENV = "test";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123456";
const ORIGIN = { Origin: "http://localhost:5173" };
const PASSWORD = "un-mot-de-passe-solide-1";

describe("Accords donnés EN LIGNE par le parent", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, p2: string, consentId: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.video.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    const par = await login("parent", Role.GUARDIAN); const par2 = await login("parent2", Role.GUARDIAN); const jeune = await login("jeune", Role.YOUTH);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: par, playerId: p1, relation: "parent" }, { userId: jeune, playerId: p1, relation: "jeune" }, { userId: par2, playerId: p2, relation: "parent" }] });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le parent donne un accord avec SON mot de passe ; un faux mot de passe n'enregistre rien", async () => {
    await A.parent.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "Parent Exemple", password: "pas-le-bon-mot-de-passe" }).expect(400);
    expect(await prisma.consent.count({ where: { playerId: p1 } })).toBe(0);
    const r = await A.parent.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "Parent Exemple", password: PASSWORD }).expect(201);
    consentId = r.body.id; expect(r.body).toMatchObject({ kind: "IMAGE", givenBy: "Parent Exemple", method: "online", withdrawnAt: null });
    // un second clic ne crée pas de doublon
    const again = await A.parent.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "Parent Exemple", password: PASSWORD }).expect(201);
    expect(again.body.id).toBe(consentId); expect(await prisma.consent.count({ where: { playerId: p1, kind: "IMAGE" } })).toBe(1);
    expect((await prisma.consent.findUniqueOrThrow({ where: { id: consentId } })).userId).not.toBeNull(); // qui l'a donné est gardé
    expect(await prisma.auditLog.count({ where: { action: "consent-online" } })).toBeGreaterThan(0);
  });

  it("le parent voit la liste des accords de SON enfant ; le coach aussi ; le compte jeune n'en donne pas", async () => {
    const mine = (await A.parent.get(`/api/players/${p1}`).expect(200)).body;
    expect(mine.consents.map((c: any) => c.kind)).toEqual(["IMAGE"]);
    expect((await A.coach.get(`/api/players/${p1}`).expect(200)).body.consents).toHaveLength(1);
    expect((await A.jeune.get(`/api/players/${p1}`).expect(200)).body.consents).toBeUndefined(); // un ancien compte jeune ne voit pas les accords
    await A.jeune.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "HEALTH", givenBy: "Léo", password: PASSWORD }).expect(403);
  });

  it("cloisonnement : un autre parent, un adulte et un coach (route réservée au parent) sont refusés", async () => {
    await A.parent2.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "FOLLOW_UP", givenBy: "Autre", password: PASSWORD }).expect(404);
    await A.parent2.get(`/api/players/${p1}`).expect(404);
    await A.adulte.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "FOLLOW_UP", givenBy: "x", password: PASSWORD }).expect(403);
    await A.coach.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "FOLLOW_UP", givenBy: "x", password: PASSWORD }).expect(403);
    await A.parent.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "N_IMPORTE_QUOI", givenBy: "Parent", password: PASSWORD }).expect(400);
    await A.parent.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "HEALTH", givenBy: "", password: PASSWORD }).expect(400);
    // le coach garde son formulaire papier
    await A.coach.post(`/api/players/${p1}/consents`).set(ORIGIN).send({ kind: "FOLLOW_UP", givenBy: "Parent Exemple", method: "paper" }).expect(201);
    await A.parent.post(`/api/players/${p1}/consents`).set(ORIGIN).send({ kind: "HEALTH", givenBy: "x", method: "paper" }).expect(403); // la saisie « papier » reste au coach
  });

  it("le parent retire l'accord de SON enfant (le droit à l'image retiré supprime les vidéos) ; pas celui d'un autre", async () => {
    await A.parent2.post(`/api/players/${p1}/consents/${consentId}/withdraw`).set(ORIGIN).expect(404);
    await A.jeune.post(`/api/players/${p1}/consents/${consentId}/withdraw`).set(ORIGIN).expect(403);
    await prisma.video.create({ data: { title: "x", playerId: p1, complete: true } });
    expect(await prisma.video.count({ where: { playerId: p1 } })).toBe(1);
    await A.parent.post(`/api/players/${p1}/consents/${consentId}/withdraw`).set(ORIGIN).expect(204);
    expect((await prisma.consent.findUniqueOrThrow({ where: { id: consentId } })).withdrawnAt).not.toBeNull();
    expect(await prisma.video.count({ where: { playerId: p1 } })).toBe(0);
    // après un retrait, le parent peut redonner son accord
    await A.parent.post(`/api/players/${p1}/consents/online`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "Parent Exemple", password: PASSWORD }).expect(201);
  });
});
