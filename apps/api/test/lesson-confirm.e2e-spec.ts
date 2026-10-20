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
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// Plus de « proposition de date » : l'adulte choisit lui-même un créneau libre chez un professeur (voir profs.e2e-spec.ts et planning.e2e-spec.ts)
describe("Cours particuliers : plus de demande libre ni de date proposée", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; const ids: Record<string, string> = {};
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } }); ids[key] = u.id;
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => { app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean(); await login("coach", Role.COACH); await login("adulte", Role.ADULT); await login("autre", Role.ADULT); await login("parent", Role.GUARDIAN); await login("trainer", Role.TRAINER); });
  afterAll(async () => { await clean(); await app.close(); });

  it("une demande sans professeur ni créneau est refusée (adulte seulement, partenaire vérifié pour un cours à deux)", async () => {
    const post = (b: object) => A.adulte.post("/api/lessons").set(ORIGIN).send(b);
    await post({ type: "individuel", objective: "Service" }).expect(400);
    await post({ type: "individuel", objective: "Service", days: ["Samedi"], moment: "Matin" }).expect(400);
    await post({ type: "individuel", objective: "Service", slot: { date: day(5), time: "18:00" } }).expect(400); // sans professeur
    await post({ type: "duo", objective: "Volée" }).expect(400); // sans partenaire
    await post({ type: "duo", objective: "Volée", partnerFirstName: "Marc", partnerLastName: "Durand", partnerAge: 45 }).expect(400); // classement manquant
    for (const k of ["coach", "parent", "trainer"]) await A[k].post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId: "x", slot: { date: day(5), time: "18:00" } }).expect(403);
  });

  it("l'adulte ne répond plus à une date proposée : la route n'existe plus ; le coach ne peut plus proposer de date ni « accepter »", async () => {
    const old = await prisma.lessonRequest.create({ data: { memberId: ids.adulte, type: "individuel", objective: "Service", status: "PROPOSED", finalSlot: { date: day(5), time: "18:30" } } }); // ancienne demande
    await A.adulte.post(`/api/lessons/${old.id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(404);
    await A.coach.post(`/api/lessons/${old.id}/answer`).set(ORIGIN).send({ status: "PROPOSED", slot: { date: day(6), time: "10:00" } }).expect(400);
    await A.coach.post(`/api/lessons/${old.id}/answer`).set(ORIGIN).send({ status: "ACCEPTED", slot: { date: day(4), time: "10:00" } }).expect(400);
    // une ancienne demande reste visible de l'adulte et le coach peut la refuser
    expect((await A.adulte.get("/api/lessons").expect(200)).body.find((l: { id: string }) => l.id === old.id)).toMatchObject({ status: "PROPOSED" });
    expect((await A.autre.get("/api/lessons").expect(200)).body).toEqual([]);
    expect((await A.coach.post(`/api/lessons/${old.id}/answer`).set(ORIGIN).send({ status: "REFUSED", reply: "Plus de proposition de date : réserve un créneau chez un professeur" }).expect(200)).body).toMatchObject({ status: "REFUSED" });
  });
});
