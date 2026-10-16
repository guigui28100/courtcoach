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

describe("Bilan de tournoi : l'entraîneur saisit, le coach valide, la famille ne voit que le validé ; étoiles « en match » ×2", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  let p1: string, p2: string, goal1: string, goalOther: string, rid: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, firstName: key === "trainer" ? "Julie" : key === "coach" ? "Guillaume" : null, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  const body = (extra: Record<string, unknown> = {}) => ({
    name: "Tournoi de Dreux", dateFrom: day, dateTo: day, feeling: 3,
    matches: [{ day, round: "Finale", result: "Victoire", score: "6-4 3-6 7-5", opponentRanking: "30/2" }, { day, round: "", result: "Défaite", score: "4-6 2-6", opponentRanking: "30/1" }],
    themes: { service: { level: "tres-bien", goalId: goal1 }, "coup-droit": { level: "bien" }, revers: { level: "a-travailler" } },
    summary: "Beau tournoi !", ...extra,
  });

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    const t = await login("trainer", Role.TRAINER); const t2 = await login("trainer2", Role.TRAINER);
    const par = await login("parent", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.create({ data: { userId: t, playerId: p1, relation: "entraineur" } });
    await prisma.playerAccess.create({ data: { userId: t2, playerId: p2, relation: "entraineur" } });
    await prisma.playerAccess.create({ data: { userId: par, playerId: p1, relation: "parent" } });
    goal1 = (await prisma.goal.create({ data: { playerId: p1, title: "Service : lancer de balle", axis: "TECHNIQUE", targetStars: 10, season: "2026-2027" } as any })).id;
    goalOther = (await prisma.goal.create({ data: { playerId: p2, title: "Revers : placement", axis: "TECHNIQUE", targetStars: 10, season: "2026-2027" } as any })).id;
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("données refusées : sans match, thème inconnu, date future, mission d'un autre joueur", async () => {
    await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body({ matches: [] })).expect(400);
    await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body({ themes: { inconnu: { level: "bien" } } })).expect(400);
    await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body({ themes: { service: { level: "super" } } })).expect(400);
    await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body({ themes: {} })).expect(400);
    await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body({ dateTo: "2999-01-01", dateFrom: "2999-01-01" })).expect(400);
    await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body({ themes: { service: { level: "bien", goalId: goalOther } } })).expect(400);
    await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body({ feeling: 7 })).expect(400);
  });

  it("l'entraîneur saisit le bilan de SON jeune ; pas celui d'un autre jeune ; l'adulte n'a aucun accès", async () => {
    const r = await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body()).expect(201);
    rid = r.body.id; expect(r.body.status).toBe("SUBMITTED"); expect(r.body.authorName).toBe("Julie");
    await A.trainer.post(`/api/players/${p2}/tournament-reports`).set(ORIGIN).send(body({ themes: { service: { level: "bien" } } })).expect(404);
    await A.trainer.get(`/api/players/${p2}/tournament-reports`).expect(404);
    await A.trainer2.get(`/api/players/${p1}/tournament-reports`).expect(404);
    await A.adulte.get(`/api/players/${p1}/tournament-reports`).expect(403);
    await A.adulte.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body()).expect(403);
  });

  it("AVANT validation : rien chez la famille (ni bilan, ni match, ni étoile) ; l'entraîneur ne peut pas valider ; le coach voit le bilan à valider", async () => {
    expect((await A.parent.get(`/api/players/${p1}/tournament-reports`).expect(200)).body).toEqual([]);
    expect((await A.parent.get(`/api/players/${p1}/matches`).expect(200)).body).toEqual([]);
    expect((await A.parent.get(`/api/players/${p1}/stars`).expect(200)).body).toEqual([]);
    await A.trainer.post(`/api/players/${p1}/tournament-reports/${rid}/validate`).set(ORIGIN).expect(403);
    await A.parent.post(`/api/players/${p1}/tournament-reports/${rid}/validate`).set(ORIGIN).expect(403);
    await A.trainer.get("/api/tournament-reports/pending").expect(403);
    const pend = (await A.coach.get("/api/tournament-reports/pending").expect(200)).body;
    expect(pend).toHaveLength(1); expect(pend[0]).toMatchObject({ id: rid, player: { firstName: "Léo" } });
    expect((await A.trainer.get(`/api/players/${p1}/tournament-reports`).expect(200)).body).toHaveLength(1);
  });

  it("l'entraîneur peut corriger son bilan tant qu'il n'est pas validé", async () => {
    const r = await A.trainer.put(`/api/players/${p1}/tournament-reports/${rid}`).set(ORIGIN).send(body({ summary: "Beau tournoi, bravo !" })).expect(200);
    expect(r.body.summary).toBe("Beau tournoi, bravo !");
    await A.trainer2.put(`/api/players/${p1}/tournament-reports/${rid}`).set(ORIGIN).send(body()).expect(404);
  });

  it("validation par le coach : matchs créés, étoiles ×2 (+2 bien, +4 très bien, jamais de moins), mission reliée ; la saisie d'un cours ne les efface pas", async () => {
    const v = await A.coach.post(`/api/players/${p1}/tournament-reports/${rid}/validate`).set(ORIGIN).expect(200);
    expect(v.body.status).toBe("VALIDATED");
    await A.coach.post(`/api/players/${p1}/tournament-reports/${rid}/validate`).set(ORIGIN).expect(400);
    const stars = (await A.coach.get(`/api/players/${p1}/stars`).expect(200)).body;
    expect(stars).toHaveLength(2); // revers « à travailler » ne donne aucune étoile
    const service = stars.find((s: any) => s.domain === "technique" && s.goalId === goal1);
    expect(service).toMatchObject({ stars: 4, reportId: rid, goalId: goal1 });
    expect(stars.find((s: any) => s.goalId === null)).toMatchObject({ stars: 2, domain: "technique" }); // coup droit : pas de mission → « hors mission »
    expect(stars.every((s: any) => s.stars > 0)).toBe(true);
    expect((await A.coach.get(`/api/players/${p1}/matches`).expect(200)).body).toHaveLength(2);
    // un cours le même jour ne remplace pas les étoiles du tournoi
    await A.coach.put(`/api/players/${p1}/stars/${day}`).set(ORIGIN).send({ items: [{ stars: 1, reason: "effort", domain: "attitude" }] }).expect(200);
    expect((await A.coach.get(`/api/players/${p1}/stars`).expect(200)).body).toHaveLength(3);
    await A.coach.delete(`/api/players/${p1}/stars/${day}`).set(ORIGIN).expect(204);
    expect((await A.coach.get(`/api/players/${p1}/stars`).expect(200)).body).toHaveLength(2);
    // ces étoiles ne se corrigent pas ligne par ligne
    await A.coach.patch(`/api/players/${p1}/stars/line/${service.id}`).set(ORIGIN).send({ stars: 1 }).expect(400);
    await A.coach.delete(`/api/players/${p1}/stars/line/${service.id}`).set(ORIGIN).expect(400);
  });

  it("repère « suivi par un entraîneur de comité » : oui pour p1, non sans entraîneur ou avec un entraîneur de club (jamais de nom)", async () => {
    const one = (await A.parent.get(`/api/players/${p1}`).expect(200)).body;
    expect(one.committeeTrainer).toBe(true);
    expect(JSON.stringify(one)).not.toContain("trainer");
    const p3 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Hugo" }).expect(201)).body.id;
    expect((await A.coach.get(`/api/players/${p3}`).expect(200)).body.committeeTrainer).toBe(false);
    const club = await login("club", Role.TRAINER); await prisma.user.update({ where: { id: club }, data: { trainerKind: "CLUB" } });
    await prisma.playerAccess.create({ data: { userId: club, playerId: p3, relation: "entraineur" } });
    expect((await A.coach.get(`/api/players/${p3}`).expect(200)).body.committeeTrainer).toBe(false);
    const list = (await A.coach.get("/api/players").expect(200)).body as { id: string; committeeTrainer: boolean }[];
    expect(list.find((x) => x.id === p1)?.committeeTrainer).toBe(true); expect(list.find((x) => x.id === p3)?.committeeTrainer).toBe(false);
  });
  it("APRÈS validation : la famille voit le bilan (sans le nom de l'auteur), les matchs et les étoiles ; plus de modification", async () => {
    const list = (await A.parent.get(`/api/players/${p1}/tournament-reports`).expect(200)).body;
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ name: "Tournoi de Dreux", status: "VALIDATED", feeling: 3 });
    for (const k of ["authorId", "authorName", "authorRole", "validatedById"]) expect(list[0][k]).toBeUndefined();
    expect((await A.parent.get(`/api/players/${p1}/matches`).expect(200)).body).toHaveLength(2);
    const st = (await A.parent.get(`/api/players/${p1}/stars`).expect(200)).body;
    expect(st).toHaveLength(2); for (const s of st) expect(s.authorName).toBeUndefined();
    await A.trainer.put(`/api/players/${p1}/tournament-reports/${rid}`).set(ORIGIN).send(body()).expect(400);
    await A.trainer.delete(`/api/players/${p1}/tournament-reports/${rid}`).set(ORIGIN).expect(404); // l'entraîneur ne supprime pas un bilan validé
    await A.parent.put(`/api/players/${p1}/tournament-reports/${rid}`).set(ORIGIN).send(body()).expect(403);
    await A.parent.delete(`/api/players/${p1}/tournament-reports/${rid}`).set(ORIGIN).expect(403);
  });

  it("l'export de la famille contient les bilans validés ; le coach supprime un bilan validé : matchs et étoiles partent avec", async () => {
    const exp = (await A.parent.get(`/api/players/${p1}/export`).expect(200)).body;
    expect(exp.tournamentReports).toHaveLength(1); expect(JSON.stringify(exp)).not.toContain("Julie");
    await A.coach.delete(`/api/players/${p1}/tournament-reports/${rid}`).set(ORIGIN).expect(204);
    expect((await A.coach.get(`/api/players/${p1}/matches`).expect(200)).body).toEqual([]);
    expect((await A.coach.get(`/api/players/${p1}/stars`).expect(200)).body).toEqual([]);
    expect((await A.coach.get(`/api/players/${p1}/tournament-reports`).expect(200)).body).toEqual([]);
  });

  it("l'entraîneur supprime son bilan avant validation ; un bilan non validé n'apparaît pas dans l'export de la famille", async () => {
    const r = await A.trainer.post(`/api/players/${p1}/tournament-reports`).set(ORIGIN).send(body()).expect(201);
    expect((await A.parent.get(`/api/players/${p1}/export`).expect(200)).body.tournamentReports).toEqual([]);
    await A.trainer.delete(`/api/players/${p1}/tournament-reports/${r.body.id}`).set(ORIGIN).expect(204);
  });
});
