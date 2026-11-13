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

describe("Gestes ajoutés et précisions des coups", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, p2: string;
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT); await login("trainer", Role.TRAINER);
    const par = await login("parent", Role.GUARDIAN); await login("autre", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.create({ data: { userId: par, playerId: p1, relation: "parent" } });
  });
  afterAll(async () => { await clean(); await app.close(); });

  const url = (id: string) => `/api/players/${id}/gestures`;
  it("seuls le coach et l'entraîneur DE CE joueur peuvent écrire ; famille et adulte jamais", async () => {
    const body = { custom: [{ label: "Service kické" }], notes: { "Coup droit": "lifté" } };
    await A.adulte.put(url(p1)).set(ORIGIN).send(body).expect(403);
    await A.parent.put(url(p1)).set(ORIGIN).send(body).expect(403);
    await A.trainer.put(url(p1)).set(ORIGIN).send(body).expect(404); // pas coché pour cet entraîneur
    const r = await A.coach.put(url(p1)).set(ORIGIN).send(body).expect(200);
    expect(r.body.custom).toEqual([{ key: "x_service_kicke", label: "Service kické" }]);
    expect(r.body.notes).toEqual({ "Coup droit": "lifté" });
  });
  it("la famille de CE joueur lit les gestes ; une autre famille jamais", async () => {
    expect((await A.parent.get(`/api/players/${p1}`).expect(200)).body.gestureConfig.custom[0].label).toBe("Service kické");
    await A.autre.get(`/api/players/${p1}`).expect(404);
  });
  it("noms et précisions vérifiés", async () => {
    await A.coach.put(url(p1)).set(ORIGIN).send({ custom: [{ label: "x" }] }).expect(400);
    await A.coach.put(url(p1)).set(ORIGIN).send({ custom: [{ label: "Slice" }, { label: "slice" }] }).expect(400);
    await A.coach.put(url(p1)).set(ORIGIN).send({ custom: [], notes: { "Coup inconnu": "a" } }).expect(400);
    await A.coach.put(url(p1)).set(ORIGIN).send({ custom: [], notes: { Revers: "a".repeat(41) } }).expect(400);
    await A.coach.put(url(p1)).set(ORIGIN).send({ custom: Array.from({ length: 9 }, (_, i) => ({ label: "Geste " + "abcdefghi"[i] })) }).expect(400);
  });
  it("une note enregistrée avec la clé d'un geste ajouté est acceptée au bilan", async () => {
    await A.coach.put(`/api/players/${p1}/evaluations/2026-2027/0`).set(ORIGIN).send({ ratings: { d_technique_x_service_kicke: 4 } }).expect(200);
  });
});
