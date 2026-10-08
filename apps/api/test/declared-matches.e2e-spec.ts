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
const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const match = (over: object = {}) => ({ day: iso(1), kind: "tournoi", event: "Plateau de Dreux", result: "Victoire", score: "6/3 6/4", opponent: "pareil", feeling: 4, wellDone: ["service", "calme"], toImprove: "revers", ...over });

describe("Matchs déclarés par le jeune", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, p2: string, mid: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    const par = await login("parent", Role.GUARDIAN); const jeune = await login("jeune", Role.YOUTH); const jeune2 = await login("jeune2", Role.YOUTH);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: par, playerId: p1, relation: "parent" }, { userId: jeune, playerId: p1, relation: "jeune" }, { userId: jeune2, playerId: p2, relation: "jeune" }] });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le jeune déclare un match avec des choix proposés ; il le voit, le coach aussi", async () => {
    const r = await A.jeune.post(`/api/players/${p1}/declared-matches`).set(ORIGIN).send(match()).expect(201);
    mid = r.body.id; expect(r.body).toMatchObject({ result: "Victoire", opponent: "pareil", feeling: 4, wellDone: ["service", "calme"], toImprove: "revers", editable: true });
    expect((await A.jeune.get(`/api/players/${p1}/declared-matches`).expect(200)).body).toHaveLength(1);
    // classement de l'adversaire (facultatif) : enregistré, relu, et effaçable
    const rk = await A.jeune.put(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).send(match({ opponentRanking: "15/2" })).expect(200); expect(rk.body.opponentRanking).toBe("15/2");
    expect((await A.jeune.put(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).send(match()).expect(200)).body.opponentRanking).toBeNull();
    expect((await A.coach.get(`/api/players/${p1}/declared-matches`).expect(200)).body).toHaveLength(1);
  });

  it("valeurs refusées : choix inconnu, note hors 1-5, 3 points forts, texte trop long, cours à venir, date trop ancienne", async () => {
    const post = (b: object) => A.jeune.post(`/api/players/${p1}/declared-matches`).set(ORIGIN).send(b);
    await post(match({ kind: "bagarre" })).expect(400);
    await post(match({ opponent: "Paul Martin" })).expect(400); // jamais de nom d'adversaire
    await post(match({ opponentRanking: "Paul Martin" })).expect(400); // le classement vient d'une liste, jamais d'un texte libre
    await post(match({ feeling: 6 })).expect(400);
    await post(match({ wellDone: ["service", "revers", "calme"] })).expect(400);
    await post(match({ wellDone: ["<script>"] })).expect(400);
    await post(match({ result: "Nul" })).expect(400);
    await post(match({ event: "x".repeat(61) })).expect(400);
    await post(match({ day: iso(-5) })).expect(400);
    await post(match({ day: iso(500) })).expect(400);
  });

  it("les PARENTS ne voient jamais ces matchs (liste, copie des données) et ne peuvent rien écrire ; un adulte non plus ; un autre jeune non plus", async () => {
    await A.parent.get(`/api/players/${p1}/declared-matches`).expect(403);
    await A.parent.post(`/api/players/${p1}/declared-matches`).set(ORIGIN).send(match()).expect(403);
    await A.parent.put(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).send(match()).expect(403);
    await A.parent.delete(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).expect(403);
    expect((await A.parent.get(`/api/players/${p1}/export`).expect(200)).body.declaredMatches).toBeUndefined();
    expect((await A.jeune.get(`/api/players/${p1}/export`).expect(200)).body.declaredMatches).toHaveLength(1);
    expect((await A.coach.get(`/api/players/${p1}/export`).expect(200)).body.declaredMatches).toHaveLength(1);
    for (const [m, u, b] of [["get", `/api/players/${p1}/declared-matches`], ["post", `/api/players/${p1}/declared-matches`, match()], ["put", `/api/players/${p1}/declared-matches/${mid}`, match()], ["delete", `/api/players/${p1}/declared-matches/${mid}`]] as any) expect([u, m, (await (A.adulte as any)[m](u).set(ORIGIN).send(b)).status]).toEqual([u, m, 403]);
    await A.jeune2.get(`/api/players/${p1}/declared-matches`).expect(404);
    await A.jeune2.post(`/api/players/${p1}/declared-matches`).set(ORIGIN).send(match()).expect(404);
    await A.jeune2.delete(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).expect(404);
    await A.coach.post(`/api/players/${p1}/declared-matches`).set(ORIGIN).send(match()).expect(403); // le coach ne déclare pas à la place du jeune
  });

  it("le jeune peut corriger son match pendant 7 jours ; ensuite il est figé (modification et suppression refusées)", async () => {
    const u = await A.jeune.put(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).send(match({ score: "6/4 6/4", feeling: 5 })).expect(200);
    expect(u.body).toMatchObject({ score: "6/4 6/4", feeling: 5 });
    await prisma.declaredMatch.update({ where: { id: mid }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } });
    expect((await A.jeune.get(`/api/players/${p1}/declared-matches`).expect(200)).body[0].editable).toBe(false);
    await A.jeune.put(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).send(match({ score: "0/6" })).expect(409);
    await A.jeune.delete(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).expect(409);
    expect((await prisma.declaredMatch.findUniqueOrThrow({ where: { id: mid } })).score).toBe("6/4 6/4");
  });

  it("le coach répond par un commentaire (lui seul) et peut supprimer un match figé ; l'effacement de la fiche efface tout", async () => {
    await A.jeune.put(`/api/players/${p1}/declared-matches/${mid}/comment`).set(ORIGIN).send({ comment: "Bravo !" }).expect(403);
    await A.parent.put(`/api/players/${p1}/declared-matches/${mid}/comment`).set(ORIGIN).send({ comment: "x" }).expect(403);
    await A.coach.put(`/api/players/${p1}/declared-matches/${mid}/comment`).set(ORIGIN).send({ comment: "x".repeat(301) }).expect(400);
    await A.coach.put(`/api/players/${p1}/declared-matches/${mid}/comment`).set(ORIGIN).send({ comment: "Bravo, belle victoire !" }).expect(200);
    expect((await A.jeune.get(`/api/players/${p1}/declared-matches`).expect(200)).body[0].coachComment).toBe("Bravo, belle victoire !");
    await A.coach.delete(`/api/players/${p1}/declared-matches/${mid}`).set(ORIGIN).expect(204);
    const again = (await A.jeune.post(`/api/players/${p1}/declared-matches`).set(ORIGIN).send(match()).expect(201)).body.id; expect(again).toBeTruthy();
    await A.coach.delete(`/api/players/${p1}`).set(ORIGIN).expect(204);
    expect(await prisma.declaredMatch.count({ where: { playerId: p1 } })).toBe(0);
  });
});
