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

describe("Objectifs par trimestre (points de contrôle)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, goal: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT); const g1 = await login("par1", Role.GUARDIAN); await login("par2", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    await prisma.playerAccess.create({ data: { userId: g1, playerId: p1, relation: "parent" } });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("un objectif peut être limité à certains trimestres (triés, sans doublon) ; trimestre 4 refusé", async () => {
    await A.coach.post(`/api/players/${p1}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "TECHNIQUE", title: "x", trimesters: [4] }).expect(400);
    const r = await A.coach.post(`/api/players/${p1}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "TECHNIQUE", title: "Service", trimesters: [2, 1, 2] }).expect(201);
    goal = r.body.id; expect(r.body.trimesters).toEqual([1, 2]);
    await A.coach.patch(`/api/goals/${goal}`).set(ORIGIN).send({ trimesters: [] }).expect(200); // vide = toute la saison
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: goal } })).trimesters).toEqual([]);
  });

  it("le coach note où en est l'objectif à la fin de chaque trimestre ; l'avancement actuel suit le dernier trimestre", async () => {
    await A.coach.put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 40, comment: "Bon début" }).expect(200);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: goal } })).progress).toBe(40);
    await A.coach.put(`/api/goals/${goal}/checkpoints/2`).set(ORIGIN).send({ progress: 70, comment: "Très bien" }).expect(200);
    await A.coach.put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 50, comment: "Bon début, corrigé" }).expect(200); // on corrige le T1 : l'actuel reste celui du T2
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: goal } })).progress).toBe(70);
    const list = (await A.coach.get(`/api/players/${p1}/goals?season=2026-2027`).expect(200)).body;
    expect(list[0].checkpoints).toEqual([{ trimester: 1, progress: 50, comment: "Bon début, corrigé" }, { trimester: 2, progress: 70, comment: "Très bien" }]);
  });

  it("valeurs invalides refusées", async () => {
    await A.coach.put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 101 }).expect(400);
    await A.coach.put(`/api/goals/${goal}/checkpoints/4`).set(ORIGIN).send({ progress: 10 }).expect(400);
    await A.coach.put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 10, comment: "x".repeat(501) }).expect(400);
    await A.coach.put(`/api/goals/inconnu/checkpoints/1`).set(ORIGIN).send({ progress: 10 }).expect(404);
  });

  it("la famille lit les points de contrôle de son enfant mais ne peut rien modifier ; adultes et autres familles : aucun accès", async () => {
    const mine = (await A.par1.get(`/api/players/${p1}/goals?season=2026-2027`).expect(200)).body;
    expect(mine[0].checkpoints).toHaveLength(2);
    await A.par1.put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 100 }).expect(403);
    await A.par1.patch(`/api/goals/${goal}`).set(ORIGIN).send({ trimesters: [1] }).expect(403);
    await A.adulte.put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 100 }).expect(403);
    await A.adulte.get(`/api/players/${p1}/goals`).expect(403);
    await A.par2.get(`/api/players/${p1}/goals`).expect(404);
    await A.par2.put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 100 }).expect(403);
    await request(app.getHttpServer()).put(`/api/goals/${goal}/checkpoints/1`).set(ORIGIN).send({ progress: 100 }).expect(401);
    expect((await prisma.goalCheckpoint.findUniqueOrThrow({ where: { goalId_trimester: { goalId: goal, trimester: 1 } } })).progress).toBe(50);
  });

  it("l'export du dossier contient les points de contrôle ; supprimer l'objectif les supprime", async () => {
    const exp = (await A.coach.get(`/api/players/${p1}/export`).expect(200)).body;
    expect(exp.goals[0].checkpoints).toHaveLength(2);
    await A.coach.delete(`/api/goals/${goal}`).set(ORIGIN).expect(204);
    expect(await prisma.goalCheckpoint.count({ where: { goalId: goal } })).toBe(0);
  });
});
