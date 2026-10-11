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

describe("Cours particuliers : le coach propose une date, l'adulte la confirme", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => { app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean(); await login("coach", Role.COACH); await login("adulte", Role.ADULT); await login("autre", Role.ADULT); await login("parent", Role.GUARDIAN); await login("trainer", Role.TRAINER); });
  afterAll(async () => { await clean(); await app.close(); });
  const ask = async () => (await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", days: ["Samedi"], moment: "Matin" }).expect(201)).body.id as string;
  const propose = (id: string, slot: { date: string; time: string }, extra = {}) => A.coach.post(`/api/lessons/${id}/answer`).set(ORIGIN).send({ status: "PROPOSED", slot, place: "Court 2", ...extra });

  it("une date proposée n'est PAS confirmée tant que l'adulte n'a pas répondu", async () => {
    const id = await ask();
    const p = (await propose(id, { date: day(5), time: "18:30" }).expect(200)).body;
    expect(p).toMatchObject({ status: "PROPOSED", finalSlot: { date: day(5), time: "18:30" }, place: "Court 2", confirmedAt: null });
    await A.coach.post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(403); // le coach ne confirme pas à la place de l'adulte
    for (const k of ["parent", "trainer"]) await A[k].post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(403);
    await A.autre.post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(404); // pas sa demande
    const ok = (await A.adulte.post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(200)).body;
    expect(ok.status).toBe("ACCEPTED"); expect(ok.confirmedAt).toBeTruthy();
    expect((await A.coach.get("/api/lessons").expect(200)).body.find((l: { id: string }) => l.id === id)).toMatchObject({ status: "ACCEPTED", finalSlot: { date: day(5), time: "18:30" } });
    await A.adulte.post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(404); // déjà confirmé
  });

  it("l'adulte pas disponible : la demande revient chez le coach avec la date refusée et son message", async () => {
    const id = await ask();
    await propose(id, { date: day(6), time: "10:00" }).expect(200);
    const r = (await A.adulte.post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "decline", message: "Je travaille ce jour-là" }).expect(200)).body;
    expect(r).toMatchObject({ status: "PENDING", finalSlot: null, declinedSlot: { date: day(6), time: "10:00" }, adultReply: "Je travaille ce jour-là" });
    // le coach propose une nouvelle date, qui efface le refus
    const again = (await propose(id, { date: day(7), time: "11:00" }).expect(200)).body;
    expect(again).toMatchObject({ status: "PROPOSED", declinedSlot: null, adultReply: "" });
  });

  it("le coach peut changer la date d'un cours déjà confirmé : l'adulte doit confirmer de nouveau ; ou l'annuler", async () => {
    const id = await ask();
    await propose(id, { date: day(5), time: "18:00" }).expect(200);
    await A.adulte.post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(200);
    const moved = (await propose(id, { date: day(8), time: "09:00" }).expect(200)).body;
    expect(moved).toMatchObject({ status: "PROPOSED", confirmedAt: null, finalSlot: { date: day(8), time: "09:00" } });
    await A.adulte.post(`/api/lessons/${id}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(200);
    const cancelled = (await A.coach.post(`/api/lessons/${id}/answer`).set(ORIGIN).send({ status: "REFUSED", reply: "Pluie annoncée, on annule" }).expect(200)).body;
    expect(cancelled).toMatchObject({ status: "REFUSED", finalSlot: null });
  });

  it("dates invalides refusées", async () => {
    const id = await ask();
    await A.coach.post(`/api/lessons/${id}/answer`).set(ORIGIN).send({ status: "PROPOSED" }).expect(400);
    await propose(id, { date: day(-4), time: "10:00" }).expect(400);
    await propose(id, { date: "2026-02-31", time: "10:00" }).expect(400);
    await propose(id, { date: day(4), time: "25:00" }).expect(400);
    await A.coach.post(`/api/lessons/${id}/answer`).set(ORIGIN).send({ status: "ACCEPTED", slot: { date: day(4), time: "10:00" } }).expect(400); // le coach ne peut plus « accepter » directement
  });
});
