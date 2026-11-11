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
  const doc = (name = "Orange du mercredi") => ({ groups: [{ id: "g1", name, level: "Balle orange · 7-9 ans", size: 8, minutes: 75, bilan: { Revers: 0, Service: 1, Smash: 9 }, notes: "revers fragile", sessions: [{ kind: "theme", theme: "Revers", title: "Revers : bases", skills: "Prise", exercise: "Panier", fil: "Jeu de jambes", note: "", done: true }] }] });

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

  it("supprimer sa progression l'efface", async () => {
    await A.prof1.put("/api/progressions").set(ORIGIN).send({ data: doc() }).expect(200);
    await A.prof1.delete("/api/progressions").set(ORIGIN).expect(204);
    expect((await A.prof1.get("/api/progressions").expect(200)).body.groups).toEqual([]);
  });
});
