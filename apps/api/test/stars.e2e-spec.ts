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

describe("Étoiles de fin de cours", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, p2: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    const par = await login("parent", Role.GUARDIAN); const jeune = await login("jeune", Role.YOUTH); await login("autre", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: par, playerId: p1, relation: "parent" }, { userId: jeune, playerId: p1, relation: "jeune" }] });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le coach donne des étoiles à la fin d'un cours ; une seule fiche par joueur et par jour (la 2e remplace la 1re)", async () => {
    const r = await A.coach.put(`/api/players/${p1}/stars/${iso(0)}`).set(ORIGIN).send({ items: [{ stars: 2, reason: "effort", domain: "technique", comment: "Bravo pour ton énergie !" }] }).expect(200);
    expect(r.body[0]).toMatchObject({ day: iso(0), stars: 2, reason: "effort", domain: "technique" });
    await A.coach.put(`/api/players/${p1}/stars/${iso(0)}`).set(ORIGIN).send({ items: [{ stars: 3, reason: "progres", domain: "technique" }] }).expect(200);
    await A.coach.put(`/api/players/${p1}/stars/${iso(3)}`).set(ORIGIN).send({ items: [{ stars: 1, reason: "ecoute", domain: "technique" }] }).expect(200);
    const list = (await A.coach.get(`/api/players/${p1}/stars`).expect(200)).body;
    expect(list.map((s: any) => [s.day, s.stars, s.reason])).toEqual([[iso(0), 3, "progres"], [iso(3), 1, "ecoute"]]);
  });

  it("plusieurs lignes le même jour (raison + domaine différents) : elles remplacent celles du jour, 20 au maximum", async () => {
    const put = (body: object) => A.coach.put(`/api/players/${p2}/stars/${iso(0)}`).set(ORIGIN).send(body);
    const r = await put({ items: [{ stars: 2, reason: "effort", domain: "mental" }, { stars: 1, reason: "progres", domain: "technique", comment: "Beau service" }, { stars: 3, reason: "fairplay", domain: "attitude" }] }).expect(200);
    expect(r.body.map((s: any) => [s.reason, s.domain, s.stars])).toEqual([["effort", "mental", 2], ["progres", "technique", 1], ["fairplay", "attitude", 3]]);
    await put({ items: [{ stars: 1, reason: "courage", domain: "mental" }] }).expect(200); // remplace tout le jour
    expect(await prisma.courseStar.count({ where: { playerId: p2 } })).toBe(1);
    // Les 4 qualités sont des étoiles : état d'esprit, motivation, assiduité, attitude (en moins : toujours expliqué)
    await put({ items: [{ stars: 3, reason: "attitude", domain: "attitude" }, { stars: 2, reason: "concentration-objectifs", domain: "mental" }] }).expect(200);
    await put({ items: [{ stars: -1, reason: "neg-concentration-objectifs", domain: "mental" }] }).expect(400);
    await put({ items: [{ stars: -1, reason: "neg-concentration-objectifs", domain: "mental", comment: "Peu d'envie" }] }).expect(200);
    await put({ items: [] }).expect(400);
    await put({ items: Array.from({ length: 21 }, () => ({ stars: 1, reason: "effort", domain: "mental" })) }).expect(400);
    await put({ items: [{ stars: 4, reason: "effort", domain: "mental" }] }).expect(400);
    await A.coach.delete(`/api/players/${p2}/stars/${iso(0)}`).set(ORIGIN).expect(204);
  });

  it("le coach retire une seule ligne d'étoiles ; les autres lignes du cours restent ; la famille ne le peut pas", async () => {
    const lines = (await A.coach.put(`/api/players/${p2}/stars/${iso(0)}`).set(ORIGIN).send({ items: [{ stars: 2, reason: "effort", domain: "mental" }, { stars: 1, reason: "progres", domain: "technique" }] }).expect(200)).body;
    await A.parent.delete(`/api/players/${p1}/stars/line/${lines[0].id}`).set(ORIGIN).expect(403);
    await A.coach.delete(`/api/players/${p1}/stars/line/${lines[0].id}`).set(ORIGIN).expect(404); // pas la fiche de ce joueur
    await A.coach.delete(`/api/players/${p2}/stars/line/${lines[0].id}`).set(ORIGIN).expect(204);
    await A.coach.delete(`/api/players/${p2}/stars/line/${lines[0].id}`).set(ORIGIN).expect(404);
    expect((await A.coach.get(`/api/players/${p2}/stars`).expect(200)).body.map((s: any) => s.reason)).toEqual(["progres"]);
    await A.coach.delete(`/api/players/${p2}/stars/${iso(0)}`).set(ORIGIN).expect(204);
  });

  it("le coach retire une étoile d'une ligne (sans toucher aux autres) ; 0 ou 4 refusés ; la famille ne le peut pas", async () => {
    const lines = (await A.coach.put(`/api/players/${p2}/stars/${iso(0)}`).set(ORIGIN).send({ items: [{ stars: 3, reason: "effort", domain: "mental" }, { stars: 2, reason: "progres", domain: "technique" }] }).expect(200)).body;
    const r = await A.coach.patch(`/api/players/${p2}/stars/line/${lines[0].id}`).set(ORIGIN).send({ stars: 2 }).expect(200);
    expect(r.body).toMatchObject({ stars: 2, reason: "effort", domain: "mental" });
    await A.coach.patch(`/api/players/${p2}/stars/line/${lines[0].id}`).set(ORIGIN).send({ stars: 0 }).expect(400);
    await A.coach.patch(`/api/players/${p2}/stars/line/${lines[0].id}`).set(ORIGIN).send({ stars: 4 }).expect(400);
    await A.coach.patch(`/api/players/${p1}/stars/line/${lines[0].id}`).set(ORIGIN).send({ stars: 1 }).expect(404);
    await A.parent.patch(`/api/players/${p2}/stars/line/${lines[0].id}`).set(ORIGIN).send({ stars: 1 }).expect(403);
    expect((await A.coach.get(`/api/players/${p2}/stars`).expect(200)).body.map((s: any) => s.stars).sort()).toEqual([2, 2]);
    await A.coach.delete(`/api/players/${p2}/stars/${iso(0)}`).set(ORIGIN).expect(204);
  });

  it("« pas en progrès » : des étoiles en moins, avec une raison « à travailler » et TOUJOURS un commentaire que le jeune et la famille voient", async () => {
    const put = (items: object[]) => A.coach.put(`/api/players/${p1}/stars/${iso(6)}`).set(ORIGIN).send({ items });
    await put([{ stars: -1, reason: "neg-attitude", domain: "attitude" }]).expect(400); // sans explication : refusé
    await put([{ stars: -1, reason: "neg-attitude", domain: "attitude", comment: "  " }]).expect(400);
    await put([{ stars: -1, reason: "effort", domain: "attitude", comment: "Tu as chahuté pendant l'exercice" }]).expect(400); // raison positive avec étoile en moins
    await put([{ stars: 2, reason: "neg-attitude", domain: "attitude", comment: "x" }]).expect(400); // raison « à travailler » avec étoile en plus
    await put([{ stars: -4, reason: "neg-attitude", domain: "attitude", comment: "Trop" }]).expect(400);
    const r = await put([{ stars: 2, reason: "effort", domain: "mental" }, { stars: -2, reason: "neg-concentration", domain: "mental", comment: "Tu étais ailleurs pendant la séance de service" }]).expect(200);
    expect(r.body.map((x: any) => x.stars).sort()).toEqual([-2, 2]);
    for (const who of ["parent", "jeune"]) {
      const list = (await A[who].get(`/api/players/${p1}/stars`).expect(200)).body;
      expect(list.find((x: any) => x.stars === -2)).toMatchObject({ reason: "neg-concentration", comment: "Tu étais ailleurs pendant la séance de service" });
    }
    // une ligne « pas en progrès » ne se corrige pas par le bouton − du radar
    const neg = r.body.find((x: any) => x.stars === -2);
    await A.coach.patch(`/api/players/${p1}/stars/line/${neg.id}`).set(ORIGIN).send({ stars: 1 }).expect(400);
    await A.coach.delete(`/api/players/${p1}/stars/${iso(6)}`).set(ORIGIN).expect(204);
  });

  it("valeurs refusées : 0 ou 4 étoiles, raison inconnue, mot trop long, date invalide, cours à venir, date trop ancienne", async () => {
    const put = (day: string, body: object) => A.coach.put(`/api/players/${p1}/stars/${day}`).set(ORIGIN).send(body);
    await put(iso(1), { items: [{ stars: 0, reason: "effort", domain: "technique" }] }).expect(400);
    await put(iso(1), { items: [{ stars: 4, reason: "effort", domain: "technique" }] }).expect(400);
    await put(iso(1), { items: [{ stars: -1, reason: "effort", domain: "technique" }] }).expect(400); // jamais d'étoile négative
    await put(iso(1), { items: [{ stars: 2, reason: "mauvais-comportement", domain: "technique" }] }).expect(400);
    await put(iso(1), { items: [{ stars: 2, reason: "effort" }] }).expect(400); // il faut choisir un domaine du radar
    await put(iso(1), { items: [{ stars: 2, reason: "effort", domain: "chance" }] }).expect(400);
    await put(iso(1), { items: [{ stars: 2, reason: "effort", domain: "technique", comment: "x".repeat(301) }] }).expect(400);
    await put("pas-une-date", { items: [{ stars: 2, reason: "effort", domain: "technique" }] }).expect(400);
    await put(iso(-10), { items: [{ stars: 2, reason: "effort", domain: "technique" }] }).expect(400);
    await put(iso(500), { items: [{ stars: 2, reason: "effort", domain: "technique" }] }).expect(400);
    await A.coach.put(`/api/players/inconnu/stars/${iso(1)}`).set(ORIGIN).send({ items: [{ stars: 2, reason: "effort", domain: "technique" }] }).expect(404);
  });

  it("la famille et le jeune lisent leurs étoiles, jamais celles d'un autre ; ils ne peuvent ni en donner ni en retirer ; un adulte n'a aucun accès", async () => {
    for (const who of ["parent", "jeune"]) expect((await A[who].get(`/api/players/${p1}/stars`).expect(200)).body).toHaveLength(2);
    await A.autre.get(`/api/players/${p1}/stars`).expect(404);
    await A.parent.get(`/api/players/${p2}/stars`).expect(404);
    for (const who of ["parent", "jeune", "autre"]) {
      await A[who].put(`/api/players/${p1}/stars/${iso(1)}`).set(ORIGIN).send({ items: [{ stars: 3, reason: "effort", domain: "technique" }] }).expect(403);
      await A[who].delete(`/api/players/${p1}/stars/${iso(0)}`).set(ORIGIN).expect(403);
    }
    await A.adulte.get(`/api/players/${p1}/stars`).expect(403);
    await A.adulte.put(`/api/players/${p1}/stars/${iso(1)}`).set(ORIGIN).send({ items: [{ stars: 3, reason: "effort", domain: "technique" }] }).expect(403);
    expect(await prisma.courseStar.count({ where: { playerId: p1 } })).toBe(2);
  });

  it("le coach peut retirer une étoile ; l'export la contient ; l'effacement de la fiche l'efface", async () => {
    await A.coach.delete(`/api/players/${p1}/stars/${iso(3)}`).set(ORIGIN).expect(204);
    await A.coach.delete(`/api/players/${p1}/stars/${iso(3)}`).set(ORIGIN).expect(404);
    expect((await A.coach.get(`/api/players/${p1}/export`).expect(200)).body.courseStars).toHaveLength(1);
    await A.coach.delete(`/api/players/${p1}`).set(ORIGIN).expect(204);
    expect(await prisma.courseStar.count({ where: { playerId: p1 } })).toBe(0);
  });
});
