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

describe("Fiche de renseignements remplie par les parents", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {}; let p1: string, p2: string;
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT); await login("trainer", Role.TRAINER);
    const par = await login("parent", Role.GUARDIAN); await login("autre", Role.GUARDIAN); const jeune = await login("jeune", Role.YOUTH);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo", lastName: "Martin", birthDate: "2014-03-14" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: par, playerId: p1, relation: "parent" }, { userId: jeune, playerId: p1, relation: "jeune" }] });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le parent remplit les renseignements de SON enfant ; le coach les voit ; nom, prénom et date de naissance ne changent pas", async () => {
    const body = { sex: "Garçon", club: "TC Houdan", licence: "1234567A", heightCm: 148, ranking: "30/1", hand: "Droitier", backhand: "À deux mains", training: "Mardi et jeudi", availability: "Week-end", health: "Genou fragile" };
    const r = await A.parent.put(`/api/players/${p1}/renseignements`).set(ORIGIN).send(body).expect(200);
    expect(r.body).toMatchObject({ club: "TC Houdan", heightCm: 148, health: "Genou fragile", firstName: "Léo", lastName: "Martin" });
    expect(r.body.coachNotes).toBeUndefined();
    const vu = (await A.coach.get(`/api/players/${p1}`).expect(200)).body;
    expect(vu).toMatchObject({ club: "TC Houdan", licence: "1234567A", ranking: "30/1", availability: "Week-end", firstName: "Léo", lastName: "Martin" });
    expect(String(vu.birthDate).slice(0, 10)).toBe("2014-03-14");
    // une valeur vide efface le champ
    expect((await A.parent.put(`/api/players/${p1}/renseignements`).set(ORIGIN).send({ club: "" }).expect(200)).body.club).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "family-update" } })).toBe(2);
  });

  it("le parent ne peut PAS changer l'identité, le style de jeu, l'objectif de classement ni les notes du coach (champs refusés)", async () => {
    for (const interdit of [{ firstName: "Piraté" }, { lastName: "X" }, { birthDate: "2000-01-01" }, { coachNotes: "x" }, { playStyle: "x" }, { targetRanking: "15" }]) {
      await A.parent.put(`/api/players/${p1}/renseignements`).set(ORIGIN).send(interdit).expect(400);
    }
    await A.parent.put(`/api/players/${p1}/renseignements`).set(ORIGIN).send({ heightCm: 10 }).expect(400);
    const vu = (await A.coach.get(`/api/players/${p1}`).expect(200)).body; expect(vu.firstName).toBe("Léo");
  });

  it("aucun autre compte ne peut le faire : autre parent (404), jeune, adulte, entraîneur (403) ; l'ancienne route de modification reste fermée aux parents", async () => {
    await A.autre.put(`/api/players/${p1}/renseignements`).set(ORIGIN).send({ club: "X" }).expect(404);
    await A.parent.put(`/api/players/${p2}/renseignements`).set(ORIGIN).send({ club: "X" }).expect(404);
    for (const k of ["jeune", "adulte", "trainer"]) await A[k].put(`/api/players/${p1}/renseignements`).set(ORIGIN).send({ club: "X" }).expect(403);
    await A.parent.patch(`/api/players/${p1}`).set(ORIGIN).send({ club: "X" }).expect(403);
  });
});
