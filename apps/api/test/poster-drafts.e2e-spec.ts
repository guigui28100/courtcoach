import { INestApplication } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app.factory";
import { PrismaService } from "../src/prisma/prisma.service";
import { VideosService } from "../src/videos/videos.service";

process.env.NODE_ENV = "test";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123456";
const ORIGIN = { Origin: "http://localhost:5173" };
const PASSWORD = "un-mot-de-passe-solide-1";
// Plus petit JPEG valide en tête : seuls les premiers octets sont vérifiés par le serveur
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);

describe("Affiches enregistrées en ligne : coach, président, bureau seulement", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  async function clean() { await prisma.posterDraft.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.user.deleteMany({ where: { email: { endsWith: "@affiches.fr" } } }); }
  async function login(key: string, role: Role) {
    const email = `${key}@affiches.fr`; await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD) } });
    A[key] = request.agent(app.getHttpServer()); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
  }
  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    for (const [k, r] of [["coach", Role.COACH], ["president", Role.PRESIDENT], ["bureau", Role.BUREAU], ["adulte", Role.ADULT], ["entraineur", Role.TRAINER], ["parent", Role.GUARDIAN], ["jeune", Role.YOUTH]] as [string, Role][]) await login(k, r);
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("entraîneur, adulte, famille et jeune n'ont aucun accès", async () => {
    for (const k of ["adulte", "entraineur", "parent", "jeune"]) {
      await A[k].get("/api/poster-drafts").expect(403);
      await A[k].post("/api/poster-drafts").set(ORIGIN).send({ kind: "resultats", name: "x", data: "{}" }).expect(403);
      await A[k].get("/api/poster-drafts/x").expect(403);
      await A[k].put("/api/poster-drafts/x").set(ORIGIN).send({ name: "x", data: "{}" }).expect(403);
      await A[k].delete("/api/poster-drafts/x").set(ORIGIN).expect(403);
      await A[k].post("/api/poster-drafts/x/photos").set(ORIGIN).set("Content-Type", "application/octet-stream").send(JPG).expect(403);
      await A[k].get("/api/poster-drafts/x/photos/y").expect(403);
    }
    await request(app.getHttpServer()).get("/api/poster-drafts").expect(401);
  });

  it("enregistre, rouvre, met à jour (photos retirées effacées) et supprime", async () => {
    const c = await A.coach.post("/api/poster-drafts").set(ORIGIN).send({ kind: "resultats", name: "Vacances", data: JSON.stringify({ d: { tournaments: [] } }) }).expect(201);
    const id = c.body.id;
    const p1 = (await A.coach.post(`/api/poster-drafts/${id}/photos`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(JPG).expect(201)).body.id;
    const p2 = (await A.coach.post(`/api/poster-drafts/${id}/photos`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(JPG).expect(201)).body.id;
    await A.coach.put(`/api/poster-drafts/${id}`).set(ORIGIN).send({ name: "Vacances", data: JSON.stringify({ d: { tournaments: [{ photos: [`srv:${p1}`] }] } }) }).expect(200);
    expect(await prisma.posterPhoto.count({ where: { draftId: id } })).toBe(1); // la photo p2 n'est plus utilisée : effacée
    // le président et le bureau voient la même affiche et la photo
    const got = (await A.president.get(`/api/poster-drafts/${id}`).expect(200)).body;
    expect(got.name).toBe("Vacances"); expect(got.data).toContain(`srv:${p1}`);
    const ph = await A.bureau.get(`/api/poster-drafts/${id}/photos/${p1}`).expect(200);
    expect(ph.headers["content-type"]).toBe("image/jpeg"); expect(ph.headers["x-content-type-options"]).toBe("nosniff");
    await A.bureau.get(`/api/poster-drafts/${id}/photos/${p2}`).expect(404);
    const list = (await A.bureau.get("/api/poster-drafts").expect(200)).body;
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ name: "Vacances", photos: 1, authorName: "coach" });
    await A.president.delete(`/api/poster-drafts/${id}`).set(ORIGIN).expect(204);
    expect(await prisma.posterPhoto.count()).toBe(0);
    await A.coach.get(`/api/poster-drafts/${id}`).expect(404);
  });

  it("refuse une fausse photo, une photo trop lourde, un texte illisible et trop d'affiches", async () => {
    const id = (await A.coach.post("/api/poster-drafts").set(ORIGIN).send({ kind: "resultats", name: "Essai", data: "{}" }).expect(201)).body.id;
    await A.coach.post(`/api/poster-drafts/${id}/photos`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(Buffer.from("<script>alert(1)</script>")).expect(400);
    await A.coach.post(`/api/poster-drafts/${id}/photos`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(Buffer.concat([JPG, Buffer.alloc(1_600_000)])).expect(413);
    await A.coach.post("/api/poster-drafts").set(ORIGIN).send({ kind: "resultats", name: "Mauvais", data: "pas du json" }).expect(400);
    await A.coach.post("/api/poster-drafts").set(ORIGIN).send({ kind: "autre", name: "x", data: "{}" }).expect(400);
    await A.coach.put(`/api/poster-drafts/inconnu`).set(ORIGIN).send({ name: "x", data: "{}" }).expect(404);
    await prisma.posterDraft.createMany({ data: Array.from({ length: 49 }, (_, i) => ({ kind: "resultats", name: `A${i}`, data: "{}", authorId: "x" })) });
    await A.coach.post("/api/poster-drafts").set(ORIGIN).send({ kind: "resultats", name: "51e", data: "{}" }).expect(409);
  });

  it("la tâche nocturne efface les affiches (et leurs photos) non modifiées depuis plus de 12 mois", async () => {
    await prisma.posterDraft.deleteMany();
    const old = await prisma.posterDraft.create({ data: { kind: "resultats", name: "Vieille", data: "{}", authorId: "x", photos: { create: [{ mime: "image/jpeg", data: Uint8Array.from(JPG) }] } } });
    await prisma.$executeRaw`UPDATE "PosterDraft" SET "updatedAt" = NOW() - INTERVAL '13 months' WHERE id = ${old.id}`;
    await prisma.posterDraft.create({ data: { kind: "resultats", name: "Récente", data: "{}", authorId: "x" } });
    const r = await app.get(VideosService).purgeExpired();
    expect(r.affiches).toBe(1);
    expect((await prisma.posterDraft.findMany()).map((x) => x.name)).toEqual(["Récente"]);
    expect(await prisma.posterPhoto.count()).toBe(0);
  });
});
