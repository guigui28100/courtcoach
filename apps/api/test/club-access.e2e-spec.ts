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
const NEW_PASSWORD = "un-autre-mot-de-passe-solide-9";

describe("Accès du club : président (gestion) et bureau (lecture seule du planning)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  const agent = () => request.agent(app.getHttpServer());
  async function clean() {
    await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.clubEvent.deleteMany(); await prisma.clubSetting.deleteMany();
    await prisma.lessonRequest.deleteMany(); await prisma.invitation.deleteMany(); await prisma.consent.deleteMany(); await prisma.profDocument.deleteMany(); await prisma.profSlot.deleteMany(); await prisma.profProfile.deleteMany(); await prisma.user.deleteMany();
  }
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
  }
  // Le coach invite, la personne accepte (elle choisit elle-même son mot de passe)
  async function invite(key: string, role: Role) {
    const email = `${key}@club.fr`;
    const r = await A.coach.post("/api/club-access/invitations").set(ORIGIN).send({ email, role }).expect(201);
    expect(r.body.token).toBeTruthy();
    const pre = (await request(app.getHttpServer()).get(`/api/auth/invitations/${r.body.token}`).expect(200)).body;
    expect(pre).toMatchObject({ email, role, playerFirstName: null });
    A[key] = agent();
    await A[key].post("/api/auth/invitations/accept").set(ORIGIN).send({ token: r.body.token, password: NEW_PASSWORD, firstName: key, acceptPolicy: true }).expect(201);
    return email;
  }
  const ev = (o: object = {}) => ({ kind: "TOURNOI", startDate: "2026-10-10", endDate: "2026-10-11", courts: [1, 2], ...o });

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    for (const [k, r] of [["coach", Role.COACH], ["adulte", Role.ADULT], ["entraineur", Role.TRAINER], ["parent", Role.GUARDIAN]] as [string, Role][]) await login(k, r);
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("seul le coach gère les accès du club (ni adulte, ni entraîneur, ni famille)", async () => {
    for (const k of ["adulte", "entraineur", "parent"]) {
      await A[k].get("/api/club-access").expect(403);
      await A[k].post("/api/club-access/invitations").set(ORIGIN).send({ email: "x@club.fr", role: "PRESIDENT" }).expect(403);
      await A[k].delete("/api/club-access/users/x").set(ORIGIN).expect(403);
      await A[k].delete("/api/club-access/invitations/x").set(ORIGIN).expect(403);
    }
    await request(app.getHttpServer()).get("/api/club-access").expect(401);
    // on ne peut inviter que président ou bureau (jamais un coach)
    await A.coach.post("/api/club-access/invitations").set(ORIGIN).send({ email: "c@club.fr", role: "COACH" }).expect(400);
  });

  it("le coach invite le président et un membre du bureau ; un seul président à la fois", async () => {
    await invite("president", Role.PRESIDENT);
    await A.coach.post("/api/club-access/invitations").set(ORIGIN).send({ email: "autre@club.fr", role: "PRESIDENT" }).expect(409);
    await invite("bureau", Role.BUREAU);
    await invite("bureau2", Role.BUREAU);
    const l = (await A.coach.get("/api/club-access").expect(200)).body;
    expect(l.users.map((u: { role: string }) => u.role).sort()).toEqual(["BUREAU", "BUREAU", "PRESIDENT"]);
    expect(l.invitations).toEqual([]);
    // e-mail déjà utilisé
    await A.coach.post("/api/club-access/invitations").set(ORIGIN).send({ email: "bureau@club.fr", role: "BUREAU" }).expect(409);
  });

  it("le président gère le planning du club ; le bureau le voit sans rien pouvoir modifier", async () => {
    const e = (await A.president.post("/api/club/events").set(ORIGIN).send(ev({ title: "Tournoi du club" })).expect(201)).body;
    await A.president.put(`/api/club/events/${e.id}`).set(ORIGIN).send(ev({ title: "Tournoi du club (modifié)" })).expect(200);
    await A.president.put("/api/club/teams").set(ORIGIN).send({ counts: {} }).expect(200);
    await A.president.put("/api/club/people").set(ORIGIN).send({ people: [] }).expect(200);
    for (const k of ["bureau", "bureau2"]) {
      const plan = (await A[k].get("/api/club/plan").expect(200)).body;
      expect(plan.events.map((x: { title: string }) => x.title)).toEqual(["Tournoi du club (modifié)"]);
      await A[k].post("/api/club/events").set(ORIGIN).send(ev()).expect(403);
      await A[k].put(`/api/club/events/${e.id}`).set(ORIGIN).send(ev()).expect(403);
      await A[k].delete(`/api/club/events/${e.id}`).set(ORIGIN).expect(403);
      await A[k].put("/api/club/events-order").set(ORIGIN).send({ ids: [e.id, "x"] }).expect(403);
      await A[k].put("/api/club/teams").set(ORIGIN).send({ counts: {} }).expect(403);
      await A[k].put("/api/club/people").set(ORIGIN).send({ people: [] }).expect(403);
    }
    await A.president.delete(`/api/club/events/${e.id}`).set(ORIGIN).expect(200);
  });

  it("le président voit les demandes de cours et toute l'activité des professeurs ; le bureau n'a rien de tout cela", async () => {
    await A.president.get("/api/lessons").expect(200);
    await A.president.get("/api/profs").expect(200);
    await A.president.get("/api/profs/admin").expect(200);
    for (const k of ["bureau", "bureau2"]) {
      await A[k].get("/api/lessons").expect(403);
      await A[k].get("/api/profs").expect(403);
      await A[k].get("/api/profs/admin").expect(403);
      await A[k].post("/api/lessons/x/confirm").set(ORIGIN).expect(403);
    }
    // ni président ni bureau n'ont d'espace de professeur
    await A.president.get("/api/profs/me").expect(403);
  });

  it("jamais le Centre de compétition jeunes, les vidéos ni le tableau de bord (président comme bureau)", async () => {
    for (const k of ["president", "bureau"]) {
      for (const url of ["/api/players", "/api/dashboard", "/api/videos", "/api/tournaments", "/api/goal-templates"]) await A[k].get(url).expect(403);
      await A[k].post("/api/players").set(ORIGIN).send({}).expect(403);
      await A[k].get("/api/club-access").expect(403);
      await A[k].post("/api/club-access/invitations").set(ORIGIN).send({ email: "z@club.fr", role: "BUREAU" }).expect(403);
    }
  });

  it("le compte ne peut pas être supprimé par la personne elle-même ; le coach ferme l'accès aussitôt", async () => {
    await A.bureau.delete("/api/auth/me").set(ORIGIN).expect(403);
    const l = (await A.coach.get("/api/club-access").expect(200)).body;
    const id = l.users.find((u: { email: string }) => u.email === "bureau2@club.fr").id;
    await A.coach.delete(`/api/club-access/users/${id}`).set(ORIGIN).expect(204);
    await A.bureau2.get("/api/club/plan").expect(401);
    await A.coach.delete(`/api/club-access/users/${id}`).set(ORIGIN).expect(404);
    const after = (await A.coach.get("/api/club-access").expect(200)).body;
    expect(after.users.length).toBe(2);
    // le coach ne peut pas supprimer un compte d'un autre type par cette route
    const adult = await prisma.user.findFirstOrThrow({ where: { email: "adulte@exemple.fr" } });
    await A.coach.delete(`/api/club-access/users/${adult.id}`).set(ORIGIN).expect(404);
  });

  it("une invitation peut être annulée ; un lien annulé ne marche plus", async () => {
    const r = (await A.coach.post("/api/club-access/invitations").set(ORIGIN).send({ email: "futur@club.fr", role: "BUREAU" }).expect(201)).body;
    const l = (await A.coach.get("/api/club-access").expect(200)).body;
    expect(l.invitations.map((i: { email: string }) => i.email)).toEqual(["futur@club.fr"]);
    await A.coach.delete(`/api/club-access/invitations/${l.invitations[0].id}`).set(ORIGIN).expect(204);
    await request(app.getHttpServer()).get(`/api/auth/invitations/${r.token}`).expect(404);
  });
});
