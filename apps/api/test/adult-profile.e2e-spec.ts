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

describe("Profil de l'adulte (nom, âge, classement ou niveau)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => { app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean(); await login("coach", Role.COACH); await login("adulte", Role.ADULT); await login("trainer", Role.TRAINER); await login("parent", Role.GUARDIAN); });
  afterAll(async () => { await clean(); await app.close(); });

  it("l'inscription accepte nom, année de naissance et niveau (facultatifs), et le coach les voit sur la demande", async () => {
    const a = request.agent(app.getHttpServer());
    const r = await a.post("/api/auth/signup").set(ORIGIN).send({ email: "marie@exemple.fr", password: PASSWORD, firstName: "Marie", lastName: "Durand", birthYear: 1985, level: "30/2", phone: "06 12 34 56 78", acceptPolicy: true }).expect(201);
    expect(r.body.id).toBeTruthy();
    await a.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", days: [], moment: "Peu importe" }).expect(201);
    const list = (await A.coach.get("/api/lessons").expect(200)).body;
    expect(list[0].member).toMatchObject({ firstName: "Marie", lastName: "Durand", birthYear: 1985, level: "30/2", phone: "06 12 34 56 78" });
    await request(app.getHttpServer()).post("/api/auth/signup").set(ORIGIN).send({ email: "x@exemple.fr", password: PASSWORD, birthYear: 1800, acceptPolicy: true }).expect(400);
  });

  it("l'adulte modifie son profil ; les autres rôles ne peuvent pas", async () => {
    const r = await A.adulte.put("/api/auth/me/profile").set(ORIGIN).send({ firstName: "Paul", lastName: "Martin", birthYear: 1990, level: "Débutant", phone: "+33 6 98 76 54 32" }).expect(200);
    expect(r.body).toMatchObject({ firstName: "Paul", lastName: "Martin", birthYear: 1990, level: "Débutant" });
    expect((await A.adulte.get("/api/auth/me").expect(200)).body).toMatchObject({ lastName: "Martin", level: "Débutant" });
    await A.adulte.put("/api/auth/me/profile").set(ORIGIN).send({ birthYear: 2200 }).expect(400);
    await A.adulte.put("/api/auth/me/profile").set(ORIGIN).send({ phone: "<script>" }).expect(400);
    for (const k of ["coach", "trainer", "parent"]) await A[k].put("/api/auth/me/profile").set(ORIGIN).send({ firstName: "x" }).expect(403);
    const exp = (await A.adulte.get("/api/auth/me/export").expect(200)).body;
    expect(JSON.stringify(exp)).toContain("Martin");
  });
});
