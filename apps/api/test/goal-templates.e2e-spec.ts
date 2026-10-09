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

describe("Bibliothèque d'objectifs (définition des objectifs)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.goalTemplate.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    for (const [k, r] of [["coach", Role.COACH], ["trainer", Role.TRAINER], ["adulte", Role.ADULT], ["parent", Role.GUARDIAN], ["jeune", Role.YOUTH]] as const) await login(k, r);
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le coach crée, modifie et supprime ; le contenu est validé", async () => {
    await A.coach.post("/api/goal-templates").set(ORIGIN).send({ axis: "TECHNIQUE", title: "x" }).expect(400);
    await A.coach.post("/api/goal-templates").set(ORIGIN).send({ axis: "NIMPORTE", title: "Revers plus long" }).expect(400);
    await A.coach.post("/api/goal-templates").set(ORIGIN).send({ axis: "TECHNIQUE", title: "Revers plus long", targetStars: 2 }).expect(400);
    const r = await A.coach.post("/api/goal-templates").set(ORIGIN).send({ axis: "TECHNIQUE", title: "  Revers plus long ", indicator: "8 sur 10", targetStars: 12 }).expect(201);
    expect(r.body).toMatchObject({ axis: "TECHNIQUE", title: "Revers plus long", indicator: "8 sur 10", targetStars: 12 });
    const u = await A.coach.patch(`/api/goal-templates/${r.body.id}`).set(ORIGIN).send({ axis: "TACTIQUE", title: "Varier les balles" }).expect(200);
    expect(u.body.axis).toBe("TACTIQUE");
    expect((await A.coach.get("/api/goal-templates").expect(200)).body).toHaveLength(1);
    await A.coach.patch("/api/goal-templates/inconnu").set(ORIGIN).send({ axis: "TACTIQUE", title: "Varier" }).expect(404);
    await A.coach.delete(`/api/goal-templates/${r.body.id}`).set(ORIGIN).expect(204);
    await A.coach.delete(`/api/goal-templates/${r.body.id}`).set(ORIGIN).expect(404);
  });

  it("l'entraîneur lit la bibliothèque mais ne la modifie pas ; adultes, familles et jeunes n'ont aucun accès", async () => {
    const r = await A.coach.post("/api/goal-templates").set(ORIGIN).send({ axis: "MENTAL", title: "Rester calme" }).expect(201);
    expect((await A.trainer.get("/api/goal-templates").expect(200)).body).toHaveLength(1);
    await A.trainer.post("/api/goal-templates").set(ORIGIN).send({ axis: "MENTAL", title: "Autre idée" }).expect(403);
    await A.trainer.patch(`/api/goal-templates/${r.body.id}`).set(ORIGIN).send({ axis: "MENTAL", title: "Modifié" }).expect(403);
    await A.trainer.delete(`/api/goal-templates/${r.body.id}`).set(ORIGIN).expect(403);
    for (const k of ["adulte", "parent", "jeune"]) {
      await A[k].get("/api/goal-templates").expect(403);
      await A[k].post("/api/goal-templates").set(ORIGIN).send({ axis: "MENTAL", title: "Intrus" }).expect(403);
      await A[k].delete(`/api/goal-templates/${r.body.id}`).set(ORIGIN).expect(403);
    }
  });
});
