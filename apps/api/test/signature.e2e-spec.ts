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
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("Signature du coach sur les bulletins", () => {
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

  it("seul le coach enregistre ou efface la signature", async () => {
    for (const k of ["adulte", "trainer", "parent"]) {
      await A[k].put("/api/signature").set(ORIGIN).send({ image: PNG }).expect(403);
      await A[k].delete("/api/signature").set(ORIGIN).expect(403);
      await A[k].get("/api/signature").expect(403);
    }
    await A.coach.put("/api/signature").set(ORIGIN).send({ image: "n'importe quoi" }).expect(400);
    await A.coach.put("/api/signature").set(ORIGIN).send({ image: "data:image/svg+xml;base64,AAAA" }).expect(400);
    await A.coach.put("/api/signature").set(ORIGIN).send({ image: PNG }).expect(200);
    expect((await A.coach.get("/api/signature").expect(200)).body.signature).toBe(PNG);
  });

  it("la famille voit la signature sur le bulletin de SON enfant seulement ; un adulte jamais", async () => {
    expect((await A.parent.get(`/api/players/${p1}/signature`).expect(200)).body.signature).toBe(PNG);
    await A.parent.get(`/api/players/${p2}/signature`).expect(404);
    await A.autre.get(`/api/players/${p1}/signature`).expect(404);
    await A.adulte.get(`/api/players/${p1}/signature`).expect(403);
    await A.trainer.get(`/api/players/${p1}/signature`).expect(404);
  });

  it("le coach peut effacer sa signature", async () => {
    await A.coach.delete("/api/signature").set(ORIGIN).expect(204);
    expect((await A.parent.get(`/api/players/${p1}/signature`).expect(200)).body.signature).toBeNull();
  });
});
