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

describe("Étoiles liées aux missions et qualités notées à chaque cours", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, p2: string, g1: string, g2: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    const ent = await login("entraineur", Role.TRAINER); const par = await login("parent", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: ent, playerId: p1, relation: "entraineur" }, { userId: par, playerId: p1, relation: "parent" }] });
    g1 = (await A.coach.post(`/api/players/${p1}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "TECHNIQUE", title: "Service", trimesters: [1] }).expect(201)).body.id;
    g2 = (await A.coach.post(`/api/players/${p2}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "MENTAL", title: "Calme", trimesters: [1] }).expect(201)).body.id;
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("une mission a un nombre d'étoiles à atteindre (10 par défaut, réglable entre 3 et 60)", async () => {
    expect((await A.coach.get(`/api/players/${p1}/goals?season=2026-2027`).expect(200)).body[0].targetStars).toBe(10);
    await A.coach.patch(`/api/goals/${g1}`).set(ORIGIN).send({ targetStars: 15 }).expect(200);
    await A.coach.patch(`/api/goals/${g1}`).set(ORIGIN).send({ targetStars: 2 }).expect(400);
    await A.coach.patch(`/api/goals/${g1}`).set(ORIGIN).send({ targetStars: 61 }).expect(400);
    expect((await A.parent.get(`/api/players/${p1}/goals?season=2026-2027`).expect(200)).body[0].targetStars).toBe(15);
  });

  it("des étoiles données SUR une mission : le domaine est celui de la mission ; jamais la mission d'un autre joueur", async () => {
    const put = (items: object[], who = "coach", pid = p1) => A[who].put(`/api/players/${pid}/stars/${iso(0)}`).set(ORIGIN).send({ items });
    const r = await put([{ stars: 2, reason: "effort", goalId: g1, domain: "mental" }]).expect(200); // le domaine envoyé est ignoré : la mission est technique
    expect(r.body[0]).toMatchObject({ goalId: g1, domain: "technique", stars: 2 });
    await put([{ stars: 1, reason: "effort", goalId: g2 }]).expect(400); // mission de Nina sur la fiche de Léo
    await put([{ stars: 1, reason: "effort" }]).expect(400); // ni mission ni domaine
    await put([{ stars: 1, reason: "effort", domain: "attitude" }]).expect(200); // sans mission : le domaine suffit (comme avant)
    await put([{ stars: 1, reason: "effort", goalId: g1 }], "entraineur").expect(200);
    await put([{ stars: 1, reason: "effort", goalId: g1 }], "entraineur", p2).expect(404);
    expect((await A.parent.get(`/api/players/${p1}/stars`).expect(200)).body[0]).toMatchObject({ goalId: g1 });
    await A.coach.delete(`/api/players/${p1}/stars/${iso(0)}`).set(ORIGIN).expect(204);
  });

  it("les quatre qualités d'un cours (1 à 5) : saisie par le coach et l'entraîneur de ses jeunes, lecture par la famille, jamais par un adulte", async () => {
    const put = (body: object, who = "coach", pid = p1, day = iso(0)) => A[who].put(`/api/players/${pid}/qualities/${day}`).set(ORIGIN).send(body);
    const r = await put({ mindset: 4, motivation: 5, attendance: 3, attitude: 4 }).expect(200);
    expect(r.body).toMatchObject({ mindset: 4, motivation: 5, attendance: 3, attitude: 4 });
    await put({ mindset: 5 }).expect(200); // remplace la fiche du jour : les autres qualités redeviennent vides
    expect((await A.coach.get(`/api/players/${p1}/qualities`).expect(200)).body).toHaveLength(1);
    expect((await A.coach.get(`/api/players/${p1}/qualities`).expect(200)).body[0]).toMatchObject({ mindset: 5, motivation: null });
    await put({}).expect(400); await put({ mindset: 0 }).expect(400); await put({ mindset: 6 }).expect(400); await put({ humeur: 3 }).expect(400);
    await put({ attitude: 3 }, "coach", p1, "pas-une-date").expect(400);
    await put({ attitude: 3 }, "entraineur").expect(200);
    await put({ attitude: 3 }, "entraineur", p2).expect(404);
    await A.entraineur.get(`/api/players/${p2}/qualities`).expect(404);
    const famille = (await A.parent.get(`/api/players/${p1}/qualities`).expect(200)).body;
    expect(famille).toHaveLength(1); expect(JSON.stringify(famille)).not.toMatch(/author/);
    await put({ attitude: 3 }, "parent").expect(403);
    await A.parent.delete(`/api/players/${p1}/qualities/${iso(0)}`).set(ORIGIN).expect(403);
    await A.adulte.get(`/api/players/${p1}/qualities`).expect(403);
    expect((await A.coach.get(`/api/players/${p1}/export`).expect(200)).body.qualities).toHaveLength(1);
    await A.coach.delete(`/api/players/${p1}/qualities/${iso(0)}`).set(ORIGIN).expect(204);
    await A.coach.delete(`/api/players/${p1}/qualities/${iso(0)}`).set(ORIGIN).expect(404);
  });
});
