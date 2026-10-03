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
const CHUNK = 2 * 1024 * 1024;

// Fausse vidéo (MP4 reconnaissable à son en-tête « ftyp ») : aucun vrai contenu.
function fakeMp4(size: number) { const b = Buffer.alloc(size, 7); b.write("ftypisom", 4, "latin1"); return b; }

describe("Vidéos et analyses", () => {
  let app: INestApplication; let prisma: PrismaService; let http: ReturnType<typeof request>;
  const agent = () => request.agent(app.getHttpServer());
  const A: Record<string, ReturnType<typeof agent>> = {};
  let p1: string, p2: string, goalP1: string, goalP2: string;

  async function login(key: string, email: string, role: Role) {
    await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD), firstName: key } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }
  async function upload(who: ReturnType<typeof agent>, meta: Record<string, unknown>, data: Buffer) {
    const c = await who.post("/api/videos").set(ORIGIN).send({ title: "Mon service", shot: "Service", sizeBytes: data.length, ...meta });
    if (c.status !== 201) return c;
    for (let i = 0; i < c.body.chunkCount; i++) await who.put(`/api/videos/${c.body.id}/chunks/${i}`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(data.subarray(i * CHUNK, (i + 1) * CHUNK)).expect(204);
    const done = await who.post(`/api/videos/${c.body.id}/complete`).set(ORIGIN);
    return Object.assign(done, { vid: c.body.id as string });
  }
  async function clean() {
    await prisma.video.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.lessonRequest.deleteMany();
    await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany();
  }

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); http = request(app.getHttpServer()); await clean();
    await login("coach", "coach@exemple.fr", Role.COACH);
    await login("adultA", "a@exemple.fr", Role.ADULT); await login("adultB", "b@exemple.fr", Role.ADULT);
    const g1 = await login("par1", "par1@exemple.fr", Role.GUARDIAN); const g2 = await login("par2", "par2@exemple.fr", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: g1, playerId: p1, relation: "parent" }, { userId: g2, playerId: p2, relation: "parent" }] });
    await A.coach.post(`/api/players/${p1}/consents`).set(ORIGIN).send({ kind: "IMAGE", givenBy: "Parent 1", method: "paper" }).expect(201); // p2 : PAS d'accord image
    goalP1 = (await A.coach.post(`/api/players/${p1}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "TECHNIQUE", title: "Service" }).expect(201)).body.id;
    goalP2 = (await A.coach.post(`/api/players/${p2}/goals`).set(ORIGIN).send({ season: "2026-2027", axis: "MENTAL", title: "Routine" }).expect(201)).body.id;
  });
  afterAll(async () => { await clean(); await app.close(); });

  let adultVideo: string, playerVideo: string;
  const data = fakeMp4(CHUNK + 500_000); // 2 morceaux

  it("exige une connexion", async () => {
    await http.get("/api/videos").expect(401);
    await http.get("/api/videos/x/file").expect(401);
  });

  it("un adulte envoie sa vidéo ; un fichier qui n'est pas une vidéo est refusé", async () => {
    const r = await upload(A.adultA, {}, data);
    expect(r.status).toBe(201); adultVideo = (r as any).vid;
    const bad = await upload(A.adultA, {}, Buffer.alloc(3000, 1));
    expect(bad.status).toBe(400);
    expect(await prisma.video.count({ where: { id: (bad as any).vid } })).toBe(0); // envoi raté nettoyé
    const c = await A.adultA.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 3000 }).expect(201);
    await A.adultA.put(`/api/videos/${c.body.id}/chunks/0`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(Buffer.alloc(10)).expect(400); // mauvaise taille
    await A.adultA.put(`/api/videos/${c.body.id}/chunks/5`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(Buffer.alloc(3000)).expect(400); // morceau hors limites
    await A.adultA.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 200 * 1024 * 1024 }).expect(400); // trop gros
  });

  it("la lecture se fait par tranches et rend exactement les octets envoyés", async () => {
    const head = await A.adultA.get(`/api/videos/${adultVideo}/file`).set("Range", "bytes=0-").buffer(true).parse((res, cb) => { const ch: Buffer[] = []; res.on("data", (d: Buffer) => ch.push(d)); res.on("end", () => cb(null, Buffer.concat(ch))); }).expect(206);
    expect(head.headers["content-range"]).toBe(`bytes 0-${CHUNK - 1}/${data.length}`);
    expect(head.headers["cache-control"]).toMatch(/no-store/);
    expect(Buffer.compare(head.body, data.subarray(0, CHUNK))).toBe(0);
    const mid = await A.adultA.get(`/api/videos/${adultVideo}/file`).set("Range", `bytes=${CHUNK - 10}-${CHUNK + 9}`).buffer(true).parse((res, cb) => { const ch: Buffer[] = []; res.on("data", (d: Buffer) => ch.push(d)); res.on("end", () => cb(null, Buffer.concat(ch))); }).expect(206);
    expect(Buffer.compare(mid.body, data.subarray(CHUNK - 10, CHUNK + 10))).toBe(0); // à cheval sur deux morceaux
    await A.adultA.get(`/api/videos/${adultVideo}/file`).set("Range", "bytes=99999999-").expect(416);
  });

  it("cloisonnement : un autre adulte, une famille ne voient jamais la vidéo d'un adulte", async () => {
    for (const who of ["adultB", "par1", "par2"]) {
      await A[who].get(`/api/videos/${adultVideo}`).expect(404);
      await A[who].get(`/api/videos/${adultVideo}/file`).expect(404);
      await A[who].delete(`/api/videos/${adultVideo}`).set(ORIGIN).expect(404);
      await A[who].post(`/api/videos/${adultVideo}/messages`).set(ORIGIN).send({ text: "x" }).expect(404);
      expect((await A[who].get("/api/videos").expect(200)).body).toEqual([]);
    }
    expect((await A.adultA.get("/api/videos").expect(200)).body).toHaveLength(1);
  });

  it("un adulte ne peut pas envoyer de vidéo « au nom » d'un jeune, ni utiliser les routes du coach", async () => {
    await A.adultA.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 3000, playerId: p1 }).expect(403);
    await A.adultA.get("/api/videos/storage").expect(403);
    await A.adultA.put(`/api/videos/${adultVideo}/analysis`).set(ORIGIN).send({ observation: "x" }).expect(403);
    await A.adultA.post(`/api/videos/${adultVideo}/analysis/send`).set(ORIGIN).expect(403);
    await A.par1.put(`/api/videos/${adultVideo}/analysis`).set(ORIGIN).send({ observation: "x" }).expect(403);
  });

  it("Centre de compétition : l'envoi exige l'accord « droit à l'image » des parents", async () => {
    await A.par2.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 3000, playerId: p2 }).expect(403); // pas d'accord image
    await A.coach.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 3000, playerId: p2 }).expect(403); // même le coach
    await A.par2.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 3000, playerId: p1 }).expect(404); // pas SON enfant
    await A.par1.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 3000 }).expect(400); // joueur obligatoire
    const r = await upload(A.par1, { playerId: p1 }, data);
    expect(r.status).toBe(201); playerVideo = (r as any).vid;
  });

  it("cloisonnement : adultes et autres familles n'accèdent jamais à la vidéo d'un jeune", async () => {
    for (const who of ["adultA", "adultB", "par2"]) {
      await A[who].get(`/api/videos/${playerVideo}`).expect(404);
      await A[who].get(`/api/videos/${playerVideo}/file`).expect(404);
      await A[who].delete(`/api/videos/${playerVideo}`).set(ORIGIN).expect(404);
    }
    expect((await A.adultA.get("/api/videos").expect(200)).body.every((v: any) => v.kind === "coaching")).toBe(true);
    expect((await A.par1.get("/api/videos").expect(200)).body.map((v: any) => v.id)).toEqual([playerVideo]);
    const coachList = (await A.coach.get("/api/videos").expect(200)).body;
    expect(coachList.map((v: any) => v.kind).sort()).toEqual(["centre", "coaching"]);
  });

  it("analyse d'une vidéo d'adulte : brouillon invisible, exercices permis, objectifs refusés ; discussion après envoi", async () => {
    await A.coach.put(`/api/videos/${adultVideo}/analysis`).set(ORIGIN).send({ observation: "Lancer de balle trop bas", improve: "Monter le bras", exercises: ["10 lancers de balle", "Service à genoux"] }).expect(200);
    await A.coach.put(`/api/videos/${adultVideo}/analysis`).set(ORIGIN).send({ observation: "x", goalIds: [goalP1] }).expect(400);
    expect((await A.adultA.get(`/api/videos/${adultVideo}`).expect(200)).body.analysis).toBeNull(); // brouillon
    await A.adultA.post(`/api/videos/${adultVideo}/messages`).set(ORIGIN).send({ text: "Bonjour" }).expect(403); // pas encore ouverte
    await A.coach.post(`/api/videos/${adultVideo}/analysis/send`).set(ORIGIN).expect(204);
    const seen = (await A.adultA.get(`/api/videos/${adultVideo}`).expect(200)).body;
    expect(seen.analysis).toMatchObject({ observation: "Lancer de balle trop bas", exercises: ["10 lancers de balle", "Service à genoux"] });
    await A.adultA.post(`/api/videos/${adultVideo}/messages`).set(ORIGIN).send({ text: "Merci coach !" }).expect(201);
    await A.coach.post(`/api/videos/${adultVideo}/messages`).set(ORIGIN).send({ text: "Avec plaisir" }).expect(201);
    const talk = (await A.adultA.get(`/api/videos/${adultVideo}`).expect(200)).body.messages;
    expect(talk.map((m: any) => [m.text, m.fromCoach, m.mine])).toEqual([["Merci coach !", false, true], ["Avec plaisir", true, false]]);
    await A.adultA.post(`/api/videos/${adultVideo}/seen`).set(ORIGIN).expect(204);
    expect((await A.adultA.get(`/api/videos/${adultVideo}`).expect(200)).body.seenAt).not.toBeNull();
    await A.adultA.post(`/api/videos/${adultVideo}/messages`).set(ORIGIN).send({ text: "x".repeat(1001) }).expect(400);
  });

  it("analyse d'une vidéo de jeune : pas d'exercices, objectifs du joueur seulement", async () => {
    await A.coach.put(`/api/videos/${playerVideo}/analysis`).set(ORIGIN).send({ observation: "x", exercises: ["a"] }).expect(400);
    await A.coach.put(`/api/videos/${playerVideo}/analysis`).set(ORIGIN).send({ observation: "x", goalIds: [goalP2] }).expect(400); // objectif d'un autre joueur
    await A.coach.put(`/api/videos/${playerVideo}/analysis`).set(ORIGIN).send({ observation: "Belle extension", goalIds: [goalP1] }).expect(200);
    await A.coach.post(`/api/videos/${playerVideo}/analysis/send`).set(ORIGIN).expect(204);
    const v = (await A.par1.get(`/api/videos/${playerVideo}`).expect(200)).body;
    expect(v.analysis.observation).toBe("Belle extension"); expect(v.linkedGoals.map((g: any) => g.title)).toEqual(["Service"]);
    expect(v.goals).toEqual([]); // la liste des objectifs à lier est réservée au coach
    await A.coach.post(`/api/videos/${adultVideo}/analysis/send`).set(ORIGIN).expect(204);
  });

  it("studio : seul le coach ajoute des images annotées ; la personne concernée les voit une fois l'analyse envoyée", async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 3)]);
    const put = (who: any, id: string, body: Buffer, note = "Bras trop bas") => who.post(`/api/videos/${id}/images`).query({ note }).set(ORIGIN).set("Content-Type", "application/octet-stream").send(body);
    // vidéo d'adulte dont l'analyse n'est PAS envoyée
    const draft = await upload(A.adultB, {}, fakeMp4(5000)); const vid = (draft as any).vid as string;
    await put(A.adultB, vid, jpeg).expect(403); // l'adhérent ne peut pas ajouter
    await put(A.par1, vid, jpeg).expect(403);
    await put(A.coach, vid, Buffer.alloc(500, 1)).expect(400); // pas une image
    await put(A.coach, vid, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(800 * 1024)])).expect(400); // trop lourde
    const ok = await put(A.coach, vid, jpeg).expect(201);
    expect((await A.coach.get(`/api/videos/${vid}`).expect(200)).body.images).toHaveLength(1); // le coach voit ses images même sans analyse
    await A.adultB.get(`/api/videos/${vid}/images/${ok.body.id}`).expect(404); // brouillon : invisible
    expect((await A.adultB.get(`/api/videos/${vid}`).expect(200)).body.images).toEqual([]);
    await A.coach.put(`/api/videos/${vid}/analysis`).set(ORIGIN).send({ observation: "Voir les images" }).expect(200);
    await A.coach.post(`/api/videos/${vid}/analysis/send`).set(ORIGIN).expect(204);
    const img = await A.adultB.get(`/api/videos/${vid}/images/${ok.body.id}`).expect(200);
    expect(img.headers["content-type"]).toBe("image/jpeg"); expect(img.headers["cache-control"]).toMatch(/no-store/);
    expect((await A.adultB.get(`/api/videos/${vid}`).expect(200)).body.images).toEqual([{ id: ok.body.id, note: "Bras trop bas" }]);
    // cloisonnement : ni un autre adulte, ni une famille
    for (const who of ["adultA", "par1", "par2"]) await A[who].get(`/api/videos/${vid}/images/${ok.body.id}`).expect(404);
    await A.adultB.delete(`/api/videos/${vid}/images/${ok.body.id}`).set(ORIGIN).expect(403);
    // 8 images au maximum
    for (let i = 0; i < 7; i++) await put(A.coach, vid, jpeg).expect(201);
    await put(A.coach, vid, jpeg).expect(400);
    await A.coach.delete(`/api/videos/${vid}/images/${ok.body.id}`).set(ORIGIN).expect(204);
    await put(A.coach, vid, jpeg).expect(201);
    // les images partent avec la vidéo
    expect(await prisma.videoImage.count({ where: { videoId: vid } })).toBe(8);
    await A.adultB.delete(`/api/videos/${vid}`).set(ORIGIN).expect(204);
    expect(await prisma.videoImage.count({ where: { videoId: vid } })).toBe(0);
  });

  it("studio : les images d'un jeune ne sont visibles que de sa famille, une fois l'analyse envoyée", async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1000, 3)]);
    const r = await A.coach.post(`/api/videos/${playerVideo}/images`).query({ note: "Extension" }).set(ORIGIN).set("Content-Type", "application/octet-stream").send(jpeg).expect(201);
    await A.par1.get(`/api/videos/${playerVideo}/images/${r.body.id}`).expect(200);
    for (const who of ["adultA", "adultB", "par2"]) await A[who].get(`/api/videos/${playerVideo}/images/${r.body.id}`).expect(404);
  });

  it("envoyer une analyse vide est refusé", async () => {
    const r = await upload(A.adultB, {}, fakeMp4(5000)); expect(r.status).toBe(201);
    await A.coach.post(`/api/videos/${(r as any).vid}/analysis/send`).set(ORIGIN).expect(400);
  });

  it("le stockage est limité (quota du club)", async () => {
    process.env.VIDEO_QUOTA_MB = "0.002";
    await A.adultB.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 5000 }).expect(507);
    delete process.env.VIDEO_QUOTA_MB;
    const s = (await A.coach.get("/api/videos/storage").expect(200)).body; expect(s.usedBytes).toBeGreaterThan(0);
  });

  it("conservation 12 mois : les vidéos expirées et les envois abandonnés sont supprimés (tâche nocturne protégée)", async () => {
    await http.get("/api/cron/purge").expect(401);
    process.env.CRON_SECRET = "secret-de-test-secret-de-test";
    await http.get("/api/cron/purge").set("Authorization", "Bearer faux").expect(401);
    const old = await prisma.video.create({ data: { title: "vieille", shot: "Service", sizeBytes: 10, complete: true, deleteAfter: new Date(Date.now() - 1000), ownerId: null } });
    const stale = await prisma.video.create({ data: { title: "abandon", shot: "Service", sizeBytes: 10, recordedAt: new Date(Date.now() - 48 * 3600 * 1000) } });
    const r = await http.get("/api/cron/purge").set("Authorization", `Bearer ${process.env.CRON_SECRET}`).expect(200);
    expect(r.body).toEqual({ expired: 1, incomplete: 1 });
    expect(await prisma.video.count({ where: { id: { in: [old.id, stale.id] } } })).toBe(0);
    delete process.env.CRON_SECRET;
    await http.get("/api/cron/purge").set("Authorization", "Bearer ").expect(401); // sans clé configurée : toujours fermé
  });

  it("retirer le droit à l'image supprime les vidéos du joueur (et leurs morceaux)", async () => {
    const consent = await prisma.consent.findFirstOrThrow({ where: { playerId: p1, kind: "IMAGE" } });
    expect(await prisma.videoChunk.count({ where: { videoId: playerVideo } })).toBeGreaterThan(0);
    await A.coach.post(`/api/players/${p1}/consents/${consent.id}/withdraw`).set(ORIGIN).expect(204);
    expect(await prisma.video.count({ where: { playerId: p1 } })).toBe(0);
    expect(await prisma.videoChunk.count({ where: { videoId: playerVideo } })).toBe(0);
    await A.par1.post("/api/videos").set(ORIGIN).send({ title: "x", shot: "Service", sizeBytes: 3000, playerId: p1 }).expect(403); // plus d'accord
  });

  it("effacer son compte supprime ses vidéos ; effacer une fiche aussi", async () => {
    await A.adultA.delete("/api/auth/me").set(ORIGIN).expect(204);
    expect(await prisma.video.count({ where: { id: adultVideo } })).toBe(0);
    expect(await prisma.videoChunk.count({ where: { videoId: adultVideo } })).toBe(0);
  });
});
