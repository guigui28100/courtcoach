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
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("Programmation des tournois (documents déposés par le coach ou un entraîneur de comité)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  let p1: string, p2: string, privateDoc: string, sharedDoc: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.tournamentDoc.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.user.deleteMany(); }
  const up = (who: string, qs: string, body: Buffer = PDF) => A[who].post(`/api/tournaments?${qs}`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(body);

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); await login("adulte", Role.ADULT);
    const ent = await login("entraineur", Role.TRAINER); const par = await login("parent", Role.GUARDIAN); const jeune = await login("jeune", Role.YOUTH); const autre = await login("autre", Role.GUARDIAN);
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
    await prisma.playerAccess.createMany({ data: [{ userId: ent, playerId: p1, relation: "entraineur" }, { userId: par, playerId: p1, relation: "parent" }, { userId: jeune, playerId: p1, relation: "jeune" }, { userId: autre, playerId: p2, relation: "parent" }] });
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("un entraîneur dépose la programmation d'un tournoi pour SES jeunes (privée par défaut) ; jamais pour un autre jeune", async () => {
    const r = await up("entraineur", `title=${encodeURIComponent("Tournoi de Dreux")}&fileName=dreux.pdf&playerIds=${p1}`).expect(201);
    privateDoc = r.body.id;
    await up("entraineur", `title=x&fileName=a.pdf&playerIds=${p2}`).expect(404);
    await up("entraineur", `title=x&fileName=a.pdf&playerIds=${p1},${p2}`).expect(404);
    await up("entraineur", `title=&fileName=a.pdf&playerIds=${p1}`).expect(400);
    await up("entraineur", `title=x&fileName=a.pdf&playerIds=`).expect(400);
  });

  it("formats et tailles : vrai contenu vérifié (PDF, image, Word, Excel) ; un exécutable renommé en .pdf est refusé ; 3 Mo maximum", async () => {
    await up("coach", `title=x&fileName=virus.pdf&playerIds=${p1}`, Buffer.from("MZ\x90\x00 programme windows")).expect(400);
    await up("coach", `title=x&fileName=page.html&playerIds=${p1}`, Buffer.from("<script>alert(1)</script>")).expect(400);
    await up("coach", `title=x&fileName=fake.docx&playerIds=${p1}`, Buffer.from("PK\x03\x04 rien de word")).expect(400);
    const docx = Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.from("[Content_Types].xml word/document.xml")]);
    await up("coach", `title=Planning&fileName=planning.docx&playerIds=${p1}`, docx).expect(201);
    await up("coach", `title=Image&fileName=planning.png&playerIds=${p1}`, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])).expect(201);
    await up("coach", `title=Gros&fileName=gros.pdf&playerIds=${p1}`, Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024 - PDF.length + 100)])).expect(400);
    await up("coach", `title=Enorme&fileName=gros.pdf&playerIds=${p1}`, Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024 + 4000)])).expect(413);
    await prisma.tournamentDoc.deleteMany({ where: { title: { in: ["Planning", "Image"] } } });
  });

  it("le coach voit tout ; l'entraîneur ses jeunes ; la famille et le jeune seulement ce qui est partagé pour leur joueur", async () => {
    sharedDoc = (await up("coach", `title=${encodeURIComponent("Tournoi de Chartres")}&fileName=chartres.pdf&playerIds=${p1},${p2}&shared=1`).expect(201)).body.id;
    const other = (await up("coach", `title=Secret&fileName=s.pdf&playerIds=${p2}`).expect(201)).body.id;
    expect((await A.coach.get("/api/tournaments").expect(200)).body.map((d: any) => d.id).sort()).toEqual([privateDoc, sharedDoc, other].sort());
    const ent = (await A.entraineur.get("/api/tournaments").expect(200)).body;
    expect(ent.map((d: any) => d.id).sort()).toEqual([privateDoc, sharedDoc].sort());
    expect(ent.find((d: any) => d.id === sharedDoc).players.map((p: any) => p.firstName)).toEqual(["Léo"]); // pas le nom d'un jeune qui n'est pas à lui
    for (const who of ["parent", "jeune"]) {
      const l = (await A[who].get("/api/tournaments").expect(200)).body;
      expect(l.map((d: any) => d.id)).toEqual([sharedDoc]);
      expect(l[0].players.map((p: any) => p.firstName)).toEqual(["Léo"]);
      expect(l[0]).not.toHaveProperty("authorName"); expect(l[0]).not.toHaveProperty("shared");
      await A[who].get(`/api/tournaments/${privateDoc}/file`).expect(404);
    }
    expect((await A.autre.get("/api/tournaments").expect(200)).body.map((d: any) => d.id)).toEqual([sharedDoc]);
    await A.autre.get(`/api/tournaments/${privateDoc}/file`).expect(404);
    await A.entraineur.get(`/api/tournaments/${other}/file`).expect(404);
  });

  it("téléchargement : bon type, jamais exécutable ; l'adulte n'a AUCUN accès ; la famille ne peut ni déposer ni supprimer", async () => {
    const r = await A.parent.get(`/api/tournaments/${sharedDoc}/file`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on("data", (d: Buffer) => c.push(d)); res.on("end", () => cb(null, Buffer.concat(c))); }).expect(200);
    expect(r.headers["content-type"]).toContain("application/pdf"); expect(r.headers["x-content-type-options"]).toBe("nosniff"); expect(r.headers["content-security-policy"]).toBe("sandbox");
    expect(r.headers["content-disposition"]).toMatch(/^inline; filename\*=UTF-8''chartres\.pdf/); expect(Buffer.compare(r.body, PDF)).toBe(0);
    await A.adulte.get("/api/tournaments").expect(403);
    await A.adulte.get(`/api/tournaments/${sharedDoc}/file`).expect(403);
    await up("adulte", `title=x&fileName=a.pdf&playerIds=${p1}`).expect(403);
    await up("parent", `title=x&fileName=a.pdf&playerIds=${p1}`).expect(403);
    await A.parent.delete(`/api/tournaments/${sharedDoc}`).set(ORIGIN).expect(403);
    await A.jeune.delete(`/api/tournaments/${sharedDoc}`).set(ORIGIN).expect(403);
  });

  it("suppression : l'entraîneur retire ses propres documents seulement ; le coach tous ; effacement automatique après 12 mois et avec la fiche", async () => {
    await A.entraineur.delete(`/api/tournaments/${sharedDoc}`).set(ORIGIN).expect(403); // déposé par le coach
    await A.entraineur.delete(`/api/tournaments/${privateDoc}`).set(ORIGIN).expect(204);
    await A.coach.delete(`/api/tournaments/${privateDoc}`).set(ORIGIN).expect(404);
    await prisma.tournamentDoc.update({ where: { id: sharedDoc }, data: { deleteAfter: new Date(Date.now() - 1000) } });
    const { VideosService } = await import("../src/videos/videos.service"); const purged = await app.get(VideosService).purgeExpired();
    expect(purged.tournois).toBe(1); expect(await prisma.tournamentDoc.findUnique({ where: { id: sharedDoc } })).toBeNull();
    await A.coach.delete(`/api/players/${p2}`).set(ORIGIN).expect(204); // le document « Secret » ne concernait que Nina : il disparaît avec elle
    expect(await prisma.tournamentDoc.count()).toBe(0);
  });
});
