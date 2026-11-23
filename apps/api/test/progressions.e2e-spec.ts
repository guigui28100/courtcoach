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

describe("Progression des séances (privée au prof)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.clubSetting.deleteMany(); await prisma.user.deleteMany(); }
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
  }
  const doc = (name = "Orange du mercredi") => ({ groups: [{ id: "g1", name, level: "Balle orange · 7-9 ans", size: 8, minutes: 75, bilan: { Revers: 0, Service: 1, Smash: 9 }, notes: "revers fragile", sessions: [{ kind: "theme", theme: "Revers", title: "Revers : bases", skills: "Prise", fil: "Jeu de jambes", note: "", done: true }] }] });

  beforeAll(async () => { app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean(); for (const [k, r] of [["coach", Role.COACH], ["prof1", Role.TRAINER], ["prof2", Role.TRAINER], ["president", Role.PRESIDENT], ["bureau", Role.BUREAU], ["adulte", Role.ADULT], ["parent", Role.GUARDIAN], ["jeune", Role.YOUTH]] as [string, Role][]) await login(k, r); });
  afterAll(async () => { await clean(); await app.close(); });

  it("chaque prof lit et enregistre SA progression ; un autre prof ne voit jamais celle d'un collègue", async () => {
    expect((await A.prof1.get("/api/progressions").expect(200)).body.groups).toEqual([]);
    await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: doc() }).expect(200);
    const mine = (await A.prof1.get("/api/progressions").expect(200)).body;
    expect(mine.groups[0].name).toBe("Orange du mercredi"); expect(mine.groups[0].sessions[0].done).toBe(true); expect(mine.groups[0].bilan).toEqual({ Revers: 0, Service: 1 }); expect(mine.groups[0].minutes).toBe(75); expect(mine.updatedAt).toBeTruthy();
    expect((await A.prof2.get("/api/progressions").expect(200)).body.groups).toEqual([]);
    expect((await A.coach.get("/api/progressions").expect(200)).body.groups).toEqual([]); // même le coach n'ouvre pas celle d'un entraîneur
    await A.coach.put("/api/progressions").set(ORIGIN).send({ data: doc("Adultes") }).expect(200);
    expect((await A.prof1.get("/api/progressions").expect(200)).body.groups[0].name).toBe("Orange du mercredi");
  });

  it("président, bureau, adultes, familles et jeunes : AUCUN accès", async () => {
    for (const k of ["president", "bureau", "adulte", "parent", "jeune"]) {
      await A[k].get("/api/progressions").expect(403);
      await A[k].put("/api/progressions").set(ORIGIN).send({ data: doc() }).expect(403);
      await A[k].delete("/api/progressions").set(ORIGIN).expect(403);
    }
    await request(app.getHttpServer()).get("/api/progressions").expect(401);
  });

  it("le contenu est nettoyé et limité", async () => {
    const big = { groups: Array.from({ length: 13 }, () => ({ name: "x", sessions: [] })) };
    await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: big }).expect(400);
    const many = { groups: [{ name: "x", sessions: Array.from({ length: 41 }, () => ({ kind: "theme" })) }] };
    await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: many }).expect(400);
    const r = (await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: { groups: [{ id: "<b>", name: "  Groupe\u0007  ", size: 999, sessions: [{ kind: "pirate", title: "a".repeat(500) }] }] } }).expect(200)).body;
    expect(r.groups[0].name).toBe("Groupe"); expect(r.groups[0].size).toBe(0); expect(r.groups[0].sessions[0].kind).toBe("theme"); expect(r.groups[0].sessions[0].title.length).toBe(120); expect(r.groups[0].id).not.toContain("<");
  });

  it("les objectifs par domaine et le déroulement sont gardés et nettoyés", async () => {
    const obj = { tech: ["Service : lancer", "x".repeat(300)], tact: [], phys: ["Endurance"], ment: [], pirate: ["non"] };
    const blocks = [{ n: "Situation", m: 20, t: "Cibles" }, ...Array.from({ length: 10 }, () => ({ n: "Jeu", m: 999, t: "a" }))];
    const r = (await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: { groups: [{ id: "g1", name: "G", sessions: [{ kind: "theme", theme: "Service", obj, blocks, mat: "paniers" }] }] } }).expect(200)).body;
    const s = r.groups[0].sessions[0];
    expect(s.obj.tech).toEqual(["Service : lancer", "x".repeat(100)]); expect(s.obj.phys).toEqual(["Endurance"]); expect(s.obj.pirate).toBeUndefined();
    expect(s.blocks.length).toBe(8); expect(s.blocks[0]).toEqual({ n: "Situation", m: 20, t: "Cibles" }); expect(s.blocks[1].m).toBe(10); expect(s.mat).toBe("paniers");
  });

  it("l'évaluation courte d'une séance est gardée et vérifiée", async () => {
    const r = (await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: { groups: [{ id: "g1", name: "G", sessions: [{ kind: "theme", done: true, rating: 3, redo: true }, { kind: "theme", rating: 9, redo: "oui" }] }] } }).expect(200)).body;
    expect(r.groups[0].sessions[0].rating).toBe(3); expect(r.groups[0].sessions[0].redo).toBe(true);
    expect(r.groups[0].sessions[1].rating).toBeUndefined(); expect(r.groups[0].sessions[1].redo).toBeUndefined();
  });

    it("les prénoms des joueurs et l'appel sont gardés, nettoyés et limités", async () => {
    const names = ["Léa", "léa", "Tom", "  ", "x".repeat(50), ...Array.from({ length: 50 }, (_, i) => `J${i}`)];
    const appel = { "2026-11-19": { Léa: "p", Tom: "a", Inconnu: "p", x: "pirate" }, "pas-une-date": { Léa: "p" }, "2026-11-20": { Léa: "e" } };
    const r = (await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: { groups: [{ id: "g1", name: "G", size: 3, players: names, appel, sessions: [] }] } }).expect(200)).body;
    const g = r.groups[0];
    expect(g.players.slice(0, 3)).toEqual(["Léa", "Tom", "x".repeat(30)]); expect(g.players.length).toBe(40); expect(g.size).toBe(40);
    expect(g.appel["2026-11-19"]).toEqual({ Léa: "p", Tom: "a" }); expect(g.appel["2026-11-20"]).toEqual({ Léa: "e" }); expect(g.appel["pas-une-date"]).toBeUndefined();
    const back = (await A.prof1.get("/api/progressions").expect(200)).body.groups[0];
    expect(back.players[0]).toBe("Léa"); expect((await A.prof2.get("/api/progressions").expect(200)).body.groups).toEqual([]);
  });

  it("le cycle complet est gardé et nettoyé : groupe, diagnostic, objectifs, séance, appel avec retard, bilans", async () => {
    const g = { id: "g1", name: "Orange", level: "Orange", players: ["Léa", "Tom"], appel: { "2026-11-20": { Léa: "r", Tom: "x" } }, teacher: "Guillaume", age: "8-9 ans", slot: "mardi 17 h", season: "2026-2027",
      diag: { t_cd: 1, t_rv: 9, zz: 2 }, diagObs: { tech: "ok", bad: "x" }, playerObs: { Léa: "forte", Inconnu: "x" },
      goals: [{ id: "o1", d: "tech", skill: "Coup droit", prio: 7 }], validated: true, checks: { "10": { text: "bilan", marks: { o1: "acquis", o9: "non" }, scores: { t_cd: 3 } }, "15": { text: "x" } },
      sessions: [{ kind: "theme", theme: "Coup droit", title: "t", date: "2026-11-20", ready: true, gl: ["o1", "bad id!"], after: { reach: { tech: "part", ment: "zzz" }, hard: "d" }, blocks: [{ n: "Situation", m: 15, t: "c", goal: "g", org: "o", ok: "k", vars: "v", mat: "m", vigil: "w", evil: "x" }] }] };
    const o = (await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: { groups: [g] } }).expect(200)).body.groups[0];
    expect(o.appel["2026-11-20"]).toEqual({ Léa: "r" }); expect(o.diag).toEqual({ t_cd: 1 }); expect(o.diagObs).toEqual({ tech: "ok" }); expect(o.playerObs).toEqual({ Léa: "forte" });
    expect(o.teacher).toBe("Guillaume"); expect(o.validated).toBe(true); expect(o.goals[0].prio).toBe(2);
    expect(o.checks["10"].marks).toEqual({ o1: "acquis" }); expect(o.checks["15"]).toBeUndefined();
    const s = o.sessions[0]; expect(s.date).toBe("2026-11-20"); expect(s.ready).toBe(true); expect(s.gl).toEqual(["o1"]); expect(s.after.reach).toEqual({ tech: "part" });
    expect(s.blocks[0].goal).toBe("g"); expect(s.blocks[0].vigil).toBe("w"); expect(s.blocks[0].evil).toBeUndefined();
  });

  it("supprimer sa progression l'efface", async () => {
    await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: doc() }).expect(200);
    await A.prof1.delete("/api/progressions").set(ORIGIN).expect(204);
    expect((await A.prof1.get("/api/progressions").expect(200)).body.groups).toEqual([]);
  });
});
