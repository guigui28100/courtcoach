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

describe("Aide au tournoi d'une animation (rattachée à l'événement)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  let anim = ""; let tournoi = "";
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.clubEvent.deleteMany(); await prisma.clubSetting.deleteMany(); await prisma.lessonRequest.deleteMany(); await prisma.user.deleteMany(); }
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
  }
  const state = (o: object = {}) => ({ dbl: false, n: 8, courts: 2, dur: 30, avail: 3, start: "14:00", fmt: "poules", mode: "jeux", opt: { jeux: "6", points: "9", temps: "20" }, durManual: null, ver: 3, names: ["Zoé", "Hugo"], scores: { "p1-0": { a: "6", b: "3" } }, pair: "hasard", perm: [], pairs: [], rounds: null, classif: "non", live: true, ...o });

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    for (const [k, r] of [["coach", Role.COACH], ["president", Role.PRESIDENT], ["bureau", Role.BUREAU], ["entraineur", Role.TRAINER], ["adulte", Role.ADULT], ["parent", Role.GUARDIAN], ["jeune", Role.YOUTH]] as [string, Role][]) await login(k, r);
    anim = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", startDate: "2026-11-14", endDate: "2026-11-14", title: "Tournoi amical" }).expect(201)).body.id;
    tournoi = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-21", endDate: "2026-11-22" }).expect(201)).body.id;
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("coach, président et bureau lisent et enregistrent le tournoi ; les autres n'ont AUCUN accès", async () => {
    expect((await A.coach.get(`/api/club/tournoi/${anim}`).expect(200)).body).toEqual({ data: null, updatedAt: null });
    await A.bureau.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: state() }).expect(200);
    const r = (await A.president.get(`/api/club/tournoi/${anim}`).expect(200)).body;
    expect(r.data.names).toEqual(["Zoé", "Hugo"]); expect(r.data.scores["p1-0"]).toEqual({ a: "6", b: "3" }); expect(r.updatedAt).toBeTruthy();
    for (const k of ["entraineur", "adulte", "parent", "jeune"]) {
      await A[k].get(`/api/club/tournoi/${anim}`).expect(403);
      await A[k].put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: state() }).expect(403);
      await A[k].delete(`/api/club/tournoi/${anim}`).set(ORIGIN).expect(403);
    }
    await request(app.getHttpServer()).get(`/api/club/tournoi/${anim}`).expect(401);
  });

  it("seule une animation peut avoir un tournoi ; un événement inconnu donne 404", async () => {
    await A.coach.get(`/api/club/tournoi/${tournoi}`).expect(400);
    await A.coach.put(`/api/club/tournoi/${tournoi}`).set(ORIGIN).send({ data: state() }).expect(400);
    await A.coach.get("/api/club/tournoi/inconnu").expect(404);
  });

  it("le serveur reconstruit le contenu : champs inconnus jetés, valeurs bornées, scores nettoyés", async () => {
    await A.coach.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: state({ n: 99999, courts: -4, fmt: "pirate", evil: "<script>", names: ["<b>Léa</b>".padEnd(80, "x"), 5], scores: { "ok-1": { a: "12abc", b: "3" }, "mauvaise clé!": { a: "1", b: "1" } } }) }).expect(200);
    const d = (await A.coach.get(`/api/club/tournoi/${anim}`).expect(200)).body.data;
    expect(d.evil).toBeUndefined(); expect(d.n).toBe(11); expect(d.courts).toBe(2); expect(d.fmt).toBe("poules");
    expect(d.names[0].length).toBeLessThanOrEqual(40); expect(d.names[1]).toBe("");
    expect(d.scores).toEqual({ "ok-1": { a: "12", b: "3" } });
    await A.coach.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: state({ plan: [{ c: 3, h: 2 }, { c: 2, h: 2 }, { c: -5, h: 99, x: "<b>" }, "mauvais"] }) }).expect(200);
    const dp = (await A.coach.get(`/api/club/tournoi/${anim}`).expect(200)).body.data;
    expect(dp.plan[0]).toEqual({ c: 3, h: 2 }); expect(dp.plan[1]).toEqual({ c: 2, h: 2 }); expect(dp.plan[2].h).toBeLessThanOrEqual(12); expect(dp.plan[2].c).toBeGreaterThanOrEqual(1); expect(dp.plan[2].x).toBeUndefined();
    await A.coach.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: state({ plan: [{ c: 3, h: 2 }] }) }).expect(200);
    expect((await A.coach.get(`/api/club/tournoi/${anim}`).expect(200)).body.data.plan).toBeNull();
    await A.coach.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: [1, 2] }).expect(400);
    await A.coach.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({}).expect(400);
  });

  it("le tournoi disparaît quand on supprime l'animation, et la tâche nocturne efface un tournoi trop ancien", async () => {
    await A.coach.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: state() }).expect(200);
    await A.coach.delete(`/api/club/tournoi/${anim}`).set(ORIGIN).expect(200);
    expect((await A.coach.get(`/api/club/tournoi/${anim}`).expect(200)).body.data).toBeNull();
    await A.coach.put(`/api/club/tournoi/${anim}`).set(ORIGIN).send({ data: state() }).expect(200);
    await A.coach.delete(`/api/club/events/${anim}`).set(ORIGIN).expect(200);
    expect(await prisma.clubSetting.count({ where: { key: `tournoi:${anim}` } })).toBe(0);
    // un vieux tournoi (13 mois) oublié en base est effacé par la tâche nocturne
    const old = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
    await prisma.clubSetting.create({ data: { key: "tournoi:vieux", value: { data: state(), updatedAt: old } } });
    await prisma.clubSetting.create({ data: { key: "tournoi:recent", value: { data: state(), updatedAt: new Date().toISOString() } } });
    const svc = app.get((await import("../src/videos/videos.service")).VideosService);
    const res = await svc.purgeExpired();
    expect(res.parties).toBe(1);
    expect(await prisma.clubSetting.count({ where: { key: "tournoi:vieux" } })).toBe(0);
    expect(await prisma.clubSetting.count({ where: { key: "tournoi:recent" } })).toBe(1);
  });
});
