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

describe("Auto-évaluation du jeune", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, p2: string, goal: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  const url = (id: string, t = 1) => `/api/players/${id}/self-evaluations/2025-2026/${t}`;

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    const y1 = await login("jeune1", Role.YOUTH); const par = await login("parent1", Role.GUARDIAN); const y2 = await login("jeune2", Role.YOUTH);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: y1, playerId: p1, relation: "jeune" }, { userId: par, playerId: p1, relation: "parent" }, { userId: y2, playerId: p2, relation: "jeune" }] });
    goal = (await A.coach.post(`/api/players/${p1}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "TECHNIQUE", title: "Service" }).expect(201)).body.id;
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le bulletin s'ouvre seulement en décembre (T1), mars (T2) et juin (T3) : avant, impossible d'écrire ou d'envoyer", async () => {
    const future = (t: number) => `/api/players/${p1}/self-evaluations/2099-2100/${t}`;
    for (const t of [1, 2, 3]) { await A.jeune1.put(future(t)).set(ORIGIN).send({ mood: 3 }).expect(409); await A.jeune1.post(`${future(t)}/send`).set(ORIGIN).expect(409); }
    const r = await A.jeune1.put(future(1)).set(ORIGIN).send({ mood: 3 }); expect(r.body.message).toContain("1er décembre 2099");
    expect(await prisma.selfEvaluation.count({ where: { playerId: p1, season: "2099-2100" } })).toBe(0);
  });

  it("le jeune remplit son bulletin (brouillon) ; le coach ne le voit pas avant l'envoi", async () => {
    const body = { mood: 4, ratings: { technique: 3, mental: 5 }, goals: { [goal]: "IN_PROGRESS" }, proud: ["service-regulier"], improve: ["deplacements"], wish: ["match"], comment: "Merci coach" };
    const r = await A.jeune1.put(url(p1)).set(ORIGIN).send(body).expect(200);
    expect(r.body).toMatchObject({ mood: 4, sentAt: null, proud: ["service-regulier"] });
    expect((await A.coach.get(`/api/players/${p1}/self-evaluations`).expect(200)).body).toHaveLength(0);
    expect((await A.jeune1.get(`/api/players/${p1}/self-evaluations`).expect(200)).body).toHaveLength(1);
    expect((await A.parent1.get(`/api/players/${p1}/self-evaluations`).expect(200)).body).toHaveLength(1);
  });

  it("valeurs refusées : note hors 1-5, statut inconnu, objectif d'un autre joueur, identifiant bizarre, texte trop long, trimestre 4 ou 0", async () => {
    await A.jeune1.put(url(p1)).set(ORIGIN).send({ ratings: { technique: 9 } }).expect(400);
    await A.jeune1.put(url(p1)).set(ORIGIN).send({ goals: { [goal]: "PEUT_ETRE" } }).expect(400);
    await A.jeune1.put(url(p1)).set(ORIGIN).send({ goals: { inconnu: "ACHIEVED" } }).expect(400);
    await A.jeune1.put(url(p1)).set(ORIGIN).send({ proud: ["<script>"] }).expect(400);
    await A.jeune1.put(url(p1)).set(ORIGIN).send({ comment: "x".repeat(301) }).expect(400);
    await A.jeune1.put(url(p1, 4)).set(ORIGIN).send({}).expect(400);
    await A.jeune1.put(url(p1, 0)).set(ORIGIN).send({}).expect(400);
  });

  it("personne d'autre ne peut écrire ou lire : autre jeune (404), adulte (403), coach ne peut pas écrire (403)", async () => {
    await A.jeune2.put(url(p1)).set(ORIGIN).send({ mood: 1 }).expect(404);
    await A.jeune2.get(`/api/players/${p1}/self-evaluations`).expect(404);
    await A.jeune2.post(`${url(p1)}/send`).set(ORIGIN).expect(404);
    for (const [m, u, b] of [["get", `/api/players/${p1}/self-evaluations`], ["put", url(p1), { mood: 1 }], ["post", `${url(p1)}/send`], ["post", `${url(p1)}/read`]] as any) {
      expect([u, m, (await (A.adulte as any)[m](u).set(ORIGIN).send(b)).status]).toEqual([u, m, 403]);
    }
    await A.coach.put(url(p1)).set(ORIGIN).send({ mood: 1 }).expect(403);
    await A.coach.post(`${url(p1)}/send`).set(ORIGIN).expect(403);
    await A.jeune1.post(`${url(p1)}/read`).set(ORIGIN).expect(403);
    expect((await prisma.selfEvaluation.findFirstOrThrow({ where: { playerId: p1 } })).mood).toBe(4);
  });

  it("envoi au coach : verrouille le bulletin ; le coach le voit et le marque comme lu", async () => {
    await A.jeune1.post(`${url(p1, 2)}/send`).set(ORIGIN).expect(404); // rien à envoyer
    await A.jeune1.post(`${url(p1)}/send`).set(ORIGIN).expect(201);
    await A.jeune1.post(`${url(p1)}/send`).set(ORIGIN).expect(409);
    await A.jeune1.put(url(p1)).set(ORIGIN).send({ mood: 2 }).expect(409);
    const list = (await A.coach.get(`/api/players/${p1}/self-evaluations`).expect(200)).body;
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ mood: 4, readAt: null }); expect(list[0].sentAt).toBeTruthy();
    await A.coach.post(`${url(p1)}/read`).set(ORIGIN).expect(201);
    expect((await prisma.selfEvaluation.findFirstOrThrow({ where: { playerId: p1 } })).readAt).toBeTruthy();
    await A.coach.post(`${url(p1, 3)}/read`).set(ORIGIN).expect(404);
  });

  it("l'effacement de la fiche efface aussi l'auto-évaluation ; l'export l'inclut", async () => {
    expect((await A.coach.get(`/api/players/${p1}/export`).expect(200)).body.selfEvaluations).toHaveLength(1);
    await A.coach.delete(`/api/players/${p1}`).set(ORIGIN).expect(204);
    expect(await prisma.selfEvaluation.count({ where: { playerId: p1 } })).toBe(0);
  });
});
