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

describe("CourtCoach API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const agent = () => request.agent(app.getHttpServer());

  async function clean() {
    await prisma.auditLog.deleteMany(); await prisma.invitation.deleteMany(); await prisma.refreshToken.deleteMany();
    await prisma.lessonRequest.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany();
    await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany();
  }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); http = request(app.getHttpServer());
    await clean();
    await prisma.user.create({ data: { email: "coach@exemple.fr", role: Role.COACH, passwordHash: await hash(PASSWORD), firstName: "Coach" } });
  });
  afterAll(async () => { await clean(); await app.close(); });

  let coach: ReturnType<typeof agent>;
  let adult: ReturnType<typeof agent>;
  let guardian: ReturnType<typeof agent>;
  let other: ReturnType<typeof agent>;
  let playerId: string;

  it("refuse tout sans connexion", async () => {
    await http.get("/api/players").expect(401);
    await http.get("/api/lessons").expect(401);
    await http.get("/api/auth/me").expect(401);
  });

  it("le coach se connecte ; un faux mot de passe est refusé sans révéler si le compte existe", async () => {
    coach = agent();
    await coach.post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD }).expect(200);
    const a = await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: "mauvais-mot-de-passe" }).expect(401);
    const b = await agent().post("/api/auth/login").set(ORIGIN).send({ email: "inconnu@exemple.fr", password: "mauvais-mot-de-passe" }).expect(401);
    expect(a.body.message).toBe(b.body.message);
    const me = await coach.get("/api/auth/me").expect(200);
    expect(me.body.role).toBe("COACH");
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash/);
  });

  it("les cookies de session sont protégés (httpOnly, SameSite)", async () => {
    const r = await agent().post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD }).expect(200);
    const cookies = (r.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
  });

  it("bloque les requêtes venant d'un autre site (CSRF)", async () => {
    await coach.post("/api/players").set({ Origin: "https://pirate.example" }).send({ firstName: "Test" }).expect(403);
  });

  it("verrouille le compte après 5 mauvais essais", async () => {
    await prisma.user.create({ data: { email: "verrou@exemple.fr", role: Role.ADULT, passwordHash: await hash(PASSWORD) } });
    for (let i = 0; i < 5; i++) await agent().post("/api/auth/login").set(ORIGIN).send({ email: "verrou@exemple.fr", password: "mauvais-mot-de-passe" }).expect(401);
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "verrou@exemple.fr", password: PASSWORD }).expect(401);
  });

  it("un adulte s'inscrit (politique obligatoire, mot de passe de 10 caractères minimum)", async () => {
    adult = agent();
    await adult.post("/api/auth/signup").set(ORIGIN).send({ email: "adulte@exemple.fr", password: PASSWORD, acceptPolicy: false }).expect(400);
    await adult.post("/api/auth/signup").set(ORIGIN).send({ email: "adulte@exemple.fr", password: "court", acceptPolicy: true }).expect(400);
    await adult.post("/api/auth/signup").set(ORIGIN).send({ email: "adulte@exemple.fr", password: PASSWORD, acceptPolicy: true, firstName: "Alex" }).expect(201);
    await agent().post("/api/auth/signup").set(ORIGIN).send({ email: "adulte@exemple.fr", password: PASSWORD, acceptPolicy: true }).expect(409);
  });

  it("impossible de s'inscrire comme coach (champ rôle refusé)", async () => {
    await agent().post("/api/auth/signup").set(ORIGIN).send({ email: "pirate@exemple.fr", password: PASSWORD, acceptPolicy: true, role: "COACH" }).expect(400);
  });

  it("demande de cours : l'adulte demande, le coach répond, l'adulte est prévenu", async () => {
    const created = await adult.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", days: ["Samedi"], moment: "Matin" }).expect(201);
    await adult.post(`/api/lessons/${created.body.id}/answer`).set(ORIGIN).send({ status: "ACCEPTED" }).expect(403);
    const list = await coach.get("/api/lessons").expect(200);
    expect(list.body).toHaveLength(1);
    await coach.post(`/api/lessons/${created.body.id}/answer`).set(ORIGIN).send({ status: "ACCEPTED", reply: "Samedi 10h, court 2" }).expect(200);
    const mine = await adult.get("/api/lessons").expect(200);
    expect(mine.body[0]).toMatchObject({ status: "ACCEPTED", coachReply: "Samedi 10h, court 2", seenByMemberAt: null });
    await adult.post(`/api/lessons/${created.body.id}/seen`).set(ORIGIN).expect(204);
    await coach.post(`/api/lessons/${created.body.id}/answer`).set(ORIGIN).send({ status: "REFUSED" }).expect(404); // déjà traitée
  });

  it("le coach crée la fiche d'un jeune, ses objectifs, évaluations et matchs", async () => {
    const p = await coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo", lastName: "Exemple", birthDate: "2014-03-14", ranking: "30/2" }).expect(201);
    playerId = p.body.id;
    await coach.patch(`/api/players/${playerId}`).set(ORIGIN).send({ health: "Épaule à surveiller", coachNotes: "Note privée" }).expect(200);
    await coach.post(`/api/players/${playerId}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "TECHNIQUE", title: "Fiabiliser la première balle", progress: 35 }).expect(201);
    await coach.put(`/api/players/${playerId}/evaluations/2026-2027/1`).set(ORIGIN).send({ ratings: { coup_droit: 4, service: 3 }, appreciation: "Bon trimestre" }).expect(200);
    await coach.put(`/api/players/${playerId}/evaluations/2026-2027/1`).set(ORIGIN).send({ ratings: { coup_droit: 9 } }).expect(400);
    await coach.put(`/api/players/${playerId}/evaluations/2026-2027/4`).set(ORIGIN).send({}).expect(400);
    await coach.post(`/api/players/${playerId}/matches`).set(ORIGIN).send({ date: "2026-09-20", tournament: "Tournoi du club", result: "Victoire", score: "6/3 6/4" }).expect(201);
    await coach.post(`/api/players/${playerId}/consents`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "Parent Exemple", method: "paper" }).expect(201);
    await coach.post(`/api/players/${playerId}/consents`).set(ORIGIN).send({ kind: "ACCOUNT", givenBy: "Parent Exemple", method: "paper" }).expect(201);
  });

  it("un adulte ne peut ni lire ni modifier les fiches du Centre", async () => {
    await adult.get("/api/players").expect(200).expect([]);
    await adult.get(`/api/players/${playerId}`).expect(404);
    await adult.post("/api/players").set(ORIGIN).send({ firstName: "X" }).expect(403);
    await adult.get(`/api/players/${playerId}/goals`).expect(404);
  });

  it("le parent invité voit la fiche en lecture seule, sans les notes privées du coach", async () => {
    const inv = await coach.post(`/api/players/${playerId}/invitations`).set(ORIGIN).send({ email: "parent@exemple.fr", role: "GUARDIAN" }).expect(201);
    const preview = await agent().get(`/api/auth/invitations/${inv.body.token}`).expect(200);
    expect(preview.body).toMatchObject({ email: "parent@exemple.fr", playerFirstName: "Léo" });
    guardian = agent();
    await guardian.post("/api/auth/invitations/accept").set(ORIGIN).send({ token: inv.body.token, password: PASSWORD, acceptPolicy: true, firstName: "Parent" }).expect(201);
    await agent().post("/api/auth/invitations/accept").set(ORIGIN).send({ token: inv.body.token, password: PASSWORD, acceptPolicy: true }).expect(404); // lien à usage unique
    const view = await guardian.get(`/api/players/${playerId}`).expect(200);
    expect(view.body.firstName).toBe("Léo");
    expect(view.body.coachNotes).toBeUndefined();
    expect(view.body.health).toBe("Épaule à surveiller");
    expect((await guardian.get(`/api/players/${playerId}/goals`).expect(200)).body).toHaveLength(1);
    expect((await guardian.get(`/api/players/${playerId}/evaluations`).expect(200)).body).toHaveLength(1);
    await guardian.patch(`/api/players/${playerId}`).set(ORIGIN).send({ firstName: "Piraté" }).expect(403);
    await guardian.post(`/api/players/${playerId}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "MENTAL", title: "x" }).expect(403);
    const exp = await guardian.get(`/api/players/${playerId}/export`).expect(200);
    expect(JSON.stringify(exp.body)).not.toMatch(/Note privée/);
  });

  it("un autre parent ne voit pas la fiche d'un enfant qui n'est pas le sien", async () => {
    const p2 = await coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201);
    const inv = await coach.post(`/api/players/${p2.body.id}/invitations`).set(ORIGIN).send({ email: "parent2@exemple.fr", role: "GUARDIAN" }).expect(201);
    other = agent();
    await other.post("/api/auth/invitations/accept").set(ORIGIN).send({ token: inv.body.token, password: PASSWORD, acceptPolicy: true }).expect(201);
    await other.get(`/api/players/${playerId}`).expect(404);
    await other.get(`/api/players/${playerId}/evaluations`).expect(404);
    expect((await other.get("/api/players").expect(200)).body.map((p: any) => p.firstName)).toEqual(["Nina"]);
  });

  it("un compte « jeune » exige l'accord écrit des parents", async () => {
    const p3 = await coach.post("/api/players").set(ORIGIN).send({ firstName: "Hugo" }).expect(201);
    const inv = await coach.post(`/api/players/${p3.body.id}/invitations`).set(ORIGIN).send({ email: "hugo@exemple.fr", role: "YOUTH" }).expect(201);
    await agent().post("/api/auth/invitations/accept").set(ORIGIN).send({ token: inv.body.token, password: PASSWORD, acceptPolicy: true }).expect(403);
    await coach.post(`/api/players/${p3.body.id}/consents`).set(ORIGIN).send({ kind: "ACCOUNT", givenBy: "Parent", method: "paper" }).expect(201);
    const youth = agent();
    await youth.post("/api/auth/invitations/accept").set(ORIGIN).send({ token: inv.body.token, password: PASSWORD, acceptPolicy: true }).expect(201);
    const view = await youth.get(`/api/players/${p3.body.id}`).expect(200);
    expect(view.body.health).toBeUndefined();
    expect(view.body.coachNotes).toBeUndefined();
  });

  it("le renouvellement de session change le jeton, et un ancien jeton réutilisé ferme la session", async () => {
    const s = agent();
    const login = await s.post("/api/auth/login").set(ORIGIN).send({ email: "coach@exemple.fr", password: PASSWORD }).expect(200);
    const rt = (login.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("cc_rt="))!.split(";")[0];
    await request(app.getHttpServer()).post("/api/auth/refresh").set(ORIGIN).set("Cookie", rt).expect(200);
    await request(app.getHttpServer()).post("/api/auth/refresh").set(ORIGIN).set("Cookie", rt).expect(401);
  });

  it("droit à l'effacement et à l'export", async () => {
    const exp = await adult.get("/api/auth/me/export").expect(200);
    expect(exp.body.email).toBe("adulte@exemple.fr");
    expect(JSON.stringify(exp.body)).not.toMatch(/passwordHash/);
    await adult.delete("/api/auth/me").set(ORIGIN).expect(204);
    await adult.get("/api/auth/me").expect(401);
    await agent().post("/api/auth/login").set(ORIGIN).send({ email: "adulte@exemple.fr", password: PASSWORD }).expect(401);
    await coach.delete(`/api/players/${playerId}`).set(ORIGIN).expect(204);
    expect(await prisma.goal.count({ where: { playerId } })).toBe(0);
    expect(await prisma.evaluation.count({ where: { playerId } })).toBe(0);
    await guardian.get(`/api/players/${playerId}`).expect(404);
  });

  it("le journal garde les actions sensibles", async () => {
    const logs = await prisma.auditLog.findMany();
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["create", "erase", "invite", "consent"]));
  });
});
