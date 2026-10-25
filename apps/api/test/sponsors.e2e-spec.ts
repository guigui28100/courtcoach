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
// Plus petit PNG valide (1 pixel) : les premiers octets sont vérifiés par le serveur
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("Partenaires du club : coach et président seulement", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  async function clean() { await prisma.sponsor.deleteMany(); await prisma.clubSetting.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.user.deleteMany({ where: { email: { endsWith: "@sponsors.fr" } } }); }
  async function login(key: string, role: Role) {
    const email = `${key}@sponsors.fr`; await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
  }
  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    for (const [k, r] of [["coach", Role.COACH], ["president", Role.PRESIDENT], ["bureau", Role.BUREAU], ["adulte", Role.ADULT], ["entraineur", Role.TRAINER], ["parent", Role.GUARDIAN]] as [string, Role][]) await login(k, r);
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("bureau, entraîneur, adulte et famille n'ont aucun accès", async () => {
    for (const k of ["bureau", "adulte", "entraineur", "parent"]) {
      await A[k].get("/api/sponsors").expect(403);
      await A[k].post("/api/sponsors").set(ORIGIN).send({ name: "X" }).expect(403);
      await A[k].put("/api/sponsors/x").set(ORIGIN).send({ name: "X" }).expect(403);
      await A[k].put("/api/sponsors/offer").set(ORIGIN).send({ intro: "", facts: [], packs: [] }).expect(403);
      await A[k].delete("/api/sponsors/x").set(ORIGIN).expect(403);
    }
    await request(app.getHttpServer()).get("/api/sponsors").expect(401);
  });

  it("le coach et le président créent, modifient et suppriment un partenaire", async () => {
    const c = await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "Boulangerie Dupont", amount: "300 € par an", status: "SIGNE", perks: ["AFFICHE_MOIS", "BACHE"], onPosters: true, logo: PNG }).expect(201);
    expect(c.body).toMatchObject({ name: "Boulangerie Dupont", status: "SIGNE", onPosters: true });
    const list = (await A.president.get("/api/sponsors").expect(200)).body;
    expect(list.sponsors).toHaveLength(1); expect(list.offer.packs.length).toBeGreaterThan(0);
    // le logo n'est pas touché quand on ne l'envoie pas ; une chaîne vide le retire
    await A.president.put(`/api/sponsors/${c.body.id}`).set(ORIGIN).send({ name: "Boulangerie Dupont", status: "PAYE", onPosters: true }).expect(200);
    expect((await prisma.sponsor.findUnique({ where: { id: c.body.id } }))!.logo).toBe(PNG);
    await A.coach.put(`/api/sponsors/${c.body.id}`).set(ORIGIN).send({ name: "Boulangerie Dupont", onPosters: true, logo: "" }).expect(400); // sur les affiches sans logo : refusé
    await A.coach.put(`/api/sponsors/${c.body.id}`).set(ORIGIN).send({ name: "Boulangerie Dupont", logo: "" }).expect(200);
    expect((await prisma.sponsor.findUnique({ where: { id: c.body.id } }))!.logo).toBe("");
    await A.coach.delete(`/api/sponsors/${c.body.id}`).set(ORIGIN).expect(200);
    await A.coach.delete(`/api/sponsors/${c.body.id}`).set(ORIGIN).expect(404);
  });

  it("refuse un faux logo, une mauvaise date, une contrepartie inconnue et un logo manquant sur les affiches", async () => {
    await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "A", logo: "data:image/png;base64,AAAAAAAAAAAAAAAAAAAA" }).expect(400); // pas une vraie image
    await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "A", logo: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" }).expect(400);
    await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "A", startDate: "2026-02-31" }).expect(400);
    await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "A", startDate: "2026-05-01", endDate: "2026-04-01" }).expect(400);
    await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "A", perks: ["N_IMPORTE_QUOI"] }).expect(400);
    await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "A", onPosters: true }).expect(400);
    await A.coach.post("/api/sponsors").set(ORIGIN).send({ name: "A", unChampInconnu: 1 }).expect(400);
  });

  it("le coach écrit l'offre du club (dossier de présentation)", async () => {
    const offer = { intro: "Bienvenue", facts: ["4 courts couverts"], packs: [{ name: "Or", price: "500 € par an", perks: ["AFFICHE_MOIS", "SITE"] }] };
    await A.coach.put("/api/sponsors/offer").set(ORIGIN).send(offer).expect(200);
    expect((await A.president.get("/api/sponsors").expect(200)).body.offer).toMatchObject(offer);
    await A.coach.put("/api/sponsors/offer").set(ORIGIN).send({ ...offer, packs: [{ name: "Or", price: "", perks: ["INCONNU"] }] }).expect(400);
  });
});
