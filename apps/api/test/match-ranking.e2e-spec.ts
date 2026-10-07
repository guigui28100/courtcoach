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

describe("Matchs : classement de l'adversaire (pour le récapitulatif du bulletin)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); const par = await login("parent", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    await prisma.playerAccess.create({ data: { userId: par, playerId: p1, relation: "parent" } });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le classement de l'adversaire est facultatif, limité aux classements de tennis, et lu par la famille", async () => {
    const m = { date: "2026-10-03", tournament: "Plateau", result: "Victoire" };
    await A.coach.post(`/api/players/${p1}/matches`).set(ORIGIN).send({ ...m, opponentRanking: "15/2" }).expect(201);
    await A.coach.post(`/api/players/${p1}/matches`).set(ORIGIN).send(m).expect(201);
    await A.coach.post(`/api/players/${p1}/matches`).set(ORIGIN).send({ ...m, opponentRanking: "99/9" }).expect(400);
    const list = (await A.parent.get(`/api/players/${p1}/matches`).expect(200)).body;
    expect(list.map((x: any) => x.opponentRanking ?? "").sort()).toEqual(["", "15/2"]);
  });
});
