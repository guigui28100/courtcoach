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
const day = new Date().toISOString().slice(0, 10);

describe("Entraîneurs de comité : ils ne voient que les jeunes que le coach leur confie", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  let p1: string, p2: string, trainerId: string, v1: string, v2: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await A.coach.patch(`/api/players/${p1}`).set(ORIGIN).send({ health: "allergie", coachNotes: "note privée" }).expect(200);
    v1 = (await prisma.video.create({ data: { title: "v1", shot: "Coup droit", sizeBytes: 1, chunkCount: 1, complete: true, playerId: p1 } })).id;
    v2 = (await prisma.video.create({ data: { title: "v2", shot: "Coup droit", sizeBytes: 1, chunkCount: 1, complete: true, playerId: p2 } })).id;
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le coach crée un entraîneur et choisit ses jeunes ; le mot de passe provisoire est montré une fois", async () => {
    const r = await A.coach.post("/api/trainers").set(ORIGIN).send({ firstName: "Julie", email: "Julie@Exemple.fr", playerIds: [p1] }).expect(201);
    expect(r.body.temporaryPassword).toHaveLength(14); trainerId = r.body.id;
    await A.coach.post("/api/trainers").set(ORIGIN).send({ firstName: "Julie", email: "julie@exemple.fr", playerIds: [] }).expect(409);
    await A.coach.post("/api/trainers").set(ORIGIN).send({ firstName: "X", email: "x@exemple.fr", playerIds: ["inconnu"] }).expect(400);
    const list = (await A.coach.get("/api/trainers").expect(200)).body;
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ email: "julie@exemple.fr", playerIds: [p1], mustChangePassword: true });
    // mot de passe provisoire : il faut le changer avant tout (puis on connecte l'entraîneur)
    const a = agent(); await a.post("/api/auth/login").set(ORIGIN).send({ email: "julie@exemple.fr", password: r.body.temporaryPassword }).expect(200);
    await a.get("/api/players").expect(403);
    await prisma.user.update({ where: { id: trainerId }, data: { passwordHash: await hash(PASSWORD), mustChangePassword: false } });
    A.trainer = agent(); await A.trainer.post("/api/auth/login").set(ORIGIN).send({ email: "julie@exemple.fr", password: PASSWORD }).expect(200);
  });

  it("l'entraîneur ne voit QUE ses jeunes (liste, fiche, objectifs, évaluations, étoiles, matchs, vidéos) ; les autres n'existent pas pour lui", async () => {
    expect((await A.trainer.get("/api/players").expect(200)).body.map((p: any) => p.id)).toEqual([p1]);
    const fiche = (await A.trainer.get(`/api/players/${p1}`).expect(200)).body;
    expect(fiche.firstName).toBe("Léo"); expect(fiche.health).toBeUndefined(); expect(fiche.coachNotes).toBeUndefined(); // santé et notes privées : réservées au coach
    for (const path of ["", "/goals", "/evaluations", "/stars", "/matches", "/self-evaluations", "/declared-matches"]) {
      await A.trainer.get(`/api/players/${p2}${path}`).expect(404);
    }
    expect((await A.trainer.get("/api/videos").expect(200)).body.map((v: any) => v.id)).toEqual([v1]);
    await A.trainer.get(`/api/videos/${v1}`).expect(200);
    await A.trainer.get(`/api/videos/${v2}`).expect(404);
  });

  it("il saisit tout le suivi de ses jeunes : objectifs, missions évaluées, bilan et bulletins, étoiles, matchs, analyses", async () => {
    const t = A.trainer;
    const g = (await t.post(`/api/players/${p1}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "TECHNIQUE", title: "Service", trimesters: [1] }).expect(201)).body;
    await t.patch(`/api/goals/${g.id}`).set(ORIGIN).send({ title: "Service plus régulier" }).expect(200);
    await t.put(`/api/goals/${g.id}/checkpoints/1`).set(ORIGIN).send({ progress: 60, comment: "Ça avance" }).expect(200);
    await t.put(`/api/players/${p1}/evaluations/2026-2027/0`).set(ORIGIN).send({ ratings: { service: 3 }, appreciation: "Bon départ" }).expect(200);
    await t.put(`/api/players/${p1}/stars/${day}`).set(ORIGIN).send({ items: [{ stars: 2, reason: "effort", domain: "mental" }] }).expect(200);
    const m = (await t.post(`/api/players/${p1}/matches`).set(ORIGIN).send({ date: day, tournament: "Plateau", result: "Victoire" }).expect(201)).body;
    await t.delete(`/api/matches/${m.id}`).set(ORIGIN).expect(204);
    await t.patch(`/api/players/${p1}`).set(ORIGIN).send({ ranking: "30/3", health: "écrasé ?", coachNotes: "écrasé ?" }).expect(200);
    const row = await prisma.player.findUniqueOrThrow({ where: { id: p1 } });
    expect(row).toMatchObject({ ranking: "30/3", health: "allergie", coachNotes: "note privée" }); // la santé et les notes du coach n'ont pas bougé
    await t.put(`/api/videos/${v1}/analysis`).set(ORIGIN).send({ observation: "Belle préparation" }).expect(200);
    await t.post(`/api/videos/${v1}/analysis/send`).set(ORIGIN).expect(204);
    // Chaque saisie garde son auteur (couleur différente côté coach), jamais montré à la famille
    await prisma.user.update({ where: { id: trainerId }, data: { firstName: "Julie" } });
    await t.put(`/api/goals/${g.id}/checkpoints/1`).set(ORIGIN).send({ progress: 70, comment: "Mieux" }).expect(200);
    const seen = (await A.coach.get(`/api/players/${p1}/goals?season=2026-2027`).expect(200)).body[0];
    expect(seen).toMatchObject({ authorName: "Julie", authorRole: "TRAINER" }); expect(seen.checkpoints[0]).toMatchObject({ authorName: "Julie", authorRole: "TRAINER" });
    await A.coach.put(`/api/players/${p1}/stars/${day}`).set(ORIGIN).send({ items: [{ stars: 1, reason: "effort", domain: "mental" }] }).expect(200);
    expect((await A.coach.get(`/api/players/${p1}/stars`).expect(200)).body[0]).toMatchObject({ authorRole: "COACH" });
    const par = await login("parent", Role.GUARDIAN); await prisma.playerAccess.create({ data: { userId: par, playerId: p1, relation: "parent" } });
    const famille = (await A.parent.get(`/api/players/${p1}/goals?season=2026-2027`).expect(200)).body[0];
    expect(JSON.stringify(famille)).not.toMatch(/author|Julie/);
    expect(JSON.stringify((await A.parent.get(`/api/players/${p1}/stars`).expect(200)).body)).not.toMatch(/author|Julie/);
    expect(JSON.stringify((await A.parent.get(`/api/players/${p1}/export`).expect(200)).body)).not.toMatch(/authorName|Julie/);
    await prisma.playerAccess.deleteMany({ where: { userId: par } });
    await t.delete(`/api/goals/${g.id}`).set(ORIGIN).expect(204);
  });

  it("jamais sur les jeunes des autres : toutes les écritures sont refusées (404)", async () => {
    const t = A.trainer;
    const g2 = (await A.coach.post(`/api/players/${p2}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "MENTAL", title: "Calme" }).expect(201)).body;
    await t.post(`/api/players/${p2}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "MENTAL", title: "x" }).expect(404);
    await t.patch(`/api/goals/${g2.id}`).set(ORIGIN).send({ title: "x" }).expect(404);
    await t.put(`/api/goals/${g2.id}/checkpoints/1`).set(ORIGIN).send({ progress: 10 }).expect(404);
    await t.delete(`/api/goals/${g2.id}`).set(ORIGIN).expect(404);
    await t.put(`/api/players/${p2}/evaluations/2026-2027/1`).set(ORIGIN).send({ ratings: {} }).expect(404);
    await t.put(`/api/players/${p2}/stars/${day}`).set(ORIGIN).send({ items: [{ stars: 1, reason: "effort", domain: "mental" }] }).expect(404);
    await t.post(`/api/players/${p2}/matches`).set(ORIGIN).send({ date: day, tournament: "x", result: "Victoire" }).expect(404);
    await t.patch(`/api/players/${p2}`).set(ORIGIN).send({ ranking: "15" }).expect(404);
    await t.put(`/api/videos/${v2}/analysis`).set(ORIGIN).send({ observation: "x" }).expect(404);
    await t.post(`/api/videos/${v2}/analysis/send`).set(ORIGIN).expect(404);
    expect(await prisma.goal.count({ where: { playerId: p2 } })).toBe(1);
  });

  it("ce qui reste réservé au coach : créer / supprimer / exporter un jeune, accords, comptes des familles, gestion des entraîneurs, demandes des adultes", async () => {
    const t = A.trainer;
    await t.post("/api/players").set(ORIGIN).send({ firstName: "Z" }).expect(403);
    await t.delete(`/api/players/${p1}`).set(ORIGIN).expect(403);
    await t.get(`/api/players/${p1}/export`).expect(403);
    await t.get("/api/players/inactive").expect(403);
    await t.post(`/api/players/${p1}/consents`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "x", method: "paper" }).expect(403);
    await t.post(`/api/players/${p1}/invitations`).set(ORIGIN).send({ email: "a@b.fr", role: "GUARDIAN" }).expect(403);
    await t.post(`/api/players/${p1}/access`).set(ORIGIN).send({ email: "a@b.fr", role: "GUARDIAN" }).expect(403);
    await t.get(`/api/players/${p1}/access`).expect(403);
    await t.get("/api/trainers").expect(403);
    await t.post("/api/trainers").set(ORIGIN).send({ firstName: "x", email: "y@z.fr", playerIds: [p2] }).expect(403);
    await t.put(`/api/trainers/${trainerId}/players`).set(ORIGIN).send({ playerIds: [p1, p2] }).expect(403); // il ne peut pas s'ajouter d'autres jeunes
    await t.get("/api/lessons").expect(403);
    await t.get("/api/videos/storage").expect(403);
    await t.delete("/api/auth/me").set(ORIGIN).expect(403);
    await A.adulte.get("/api/trainers").expect(403);
    await A.adulte.get(`/api/players/${p1}`).expect(403);
  });

  it("le coach change les jeunes confiés : l'entraîneur perd l'accès aux anciens et gagne les nouveaux, tout de suite", async () => {
    await A.coach.put(`/api/trainers/${trainerId}/players`).set(ORIGIN).send({ playerIds: [p2] }).expect(200);
    await A.trainer.get(`/api/players/${p1}`).expect(404);
    await A.trainer.get(`/api/videos/${v1}`).expect(404);
    await A.trainer.get(`/api/players/${p2}`).expect(200);
    expect((await A.trainer.get("/api/players").expect(200)).body.map((p: any) => p.id)).toEqual([p2]);
    await A.coach.put(`/api/trainers/${trainerId}/players`).set(ORIGIN).send({ playerIds: [] }).expect(200);
    expect((await A.trainer.get("/api/players").expect(200)).body).toEqual([]);
  });

  it("mot de passe oublié puis suppression du compte : les sessions se ferment et l'accès disparaît", async () => {
    const r = await A.coach.post(`/api/trainers/${trainerId}/reset-password`).set(ORIGIN).expect(200);
    expect(r.body.temporaryPassword).toHaveLength(14);
    await A.trainer.get("/api/players").expect(403); // son ancien accès ne mène plus à rien : il doit choisir un nouveau mot de passe
    await A.coach.delete(`/api/trainers/${trainerId}`).set(ORIGIN).expect(204);
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "julie@exemple.fr", password: r.body.temporaryPassword }).expect(401);
    expect((await A.coach.get("/api/trainers").expect(200)).body).toEqual([]);
  });
});
