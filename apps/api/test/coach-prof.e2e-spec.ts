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
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

// Un seul compte : le coach peut lui-même donner des cours particuliers (même parcours qu'un entraîneur)
describe("Le coach donne aussi des cours particuliers avec son compte", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  let coachId: string, lessonId: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role, extra: object = {}) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD), ...extra } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.lessonRequest.deleteMany(); await prisma.user.deleteMany(); }
  const upload = (who: string, kind: string, q = "") => A[who].put(`/api/profs/me/documents/${kind}?fileName=piece.pdf${q}`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(PDF);

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    coachId = await login("coach", Role.COACH); await login("adulte", Role.ADULT); await login("famille", Role.GUARDIAN);
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le coach clique « je souhaite donner des cours », remplit sa fiche, ses disponibilités et ses pièces", async () => {
    expect((await A.coach.get("/api/profs/me").expect(200)).body.optedIn).toBe(false);
    await A.coach.post("/api/profs/me/optin").set(ORIGIN).expect(200);
    const r = await A.coach.put("/api/profs/me").set(ORIGIN).send({ firstName: "Guillaume", lastName: "Poussin", ranking: "15/1" }).expect(200);
    expect(r.body).toMatchObject({ firstName: "Guillaume", lastName: "Poussin" });
    await A.coach.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [{ date: future(5), start: "18:00", end: "20:00" }] }).expect(200);
    await upload("coach", "DIPLOME").expect(200); await upload("coach", "AUTO_ENTREPRENEUR").expect(200);
    expect((await upload("coach", "CARTE_PRO", `&validUntil=${future(300)}`).expect(200)).body.status).toBe("waiting");
    // l'adulte ne le voit pas tant qu'il n'a pas validé sa fiche
    expect((await A.adulte.get("/api/profs").expect(200)).body.profs).toEqual([]);
    await A.coach.post(`/api/profs/${coachId}/approval`).set(ORIGIN).send({ approved: true }).expect(200);
    const seen = (await A.adulte.get("/api/profs").expect(200)).body.profs;
    expect(seen).toHaveLength(1); expect(seen[0]).toMatchObject({ id: coachId, firstName: "Guillaume", lastName: "Poussin" });
    expect(JSON.stringify(seen)).not.toContain("exemple.fr");
  });

  it("l'adulte réserve chez le coach ; le coach confirme avec le même compte ; un parent n'a aucun accès", async () => {
    const days = (await A.adulte.get(`/api/profs/${coachId}/planning`).expect(200)).body.days as { date: string; slots: { time: string; free: boolean }[] }[];
    const slot = days.flatMap((d) => d.slots.filter((s) => s.free).map((s) => ({ date: d.date, time: s.time })))[0];
    const l = (await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId: coachId, slot }).expect(201)).body;
    expect(l).toMatchObject({ status: "BOOKED", profId: coachId }); lessonId = l.id;
    const mine = (await A.coach.get("/api/lessons").expect(200)).body as { id: string; profId: string | null }[];
    expect(mine.find((x) => x.id === lessonId)!.profId).toBe(coachId);
    await A.coach.post(`/api/lessons/${lessonId}/confirm`).set(ORIGIN).expect(200);
    expect((await prisma.lessonRequest.findUnique({ where: { id: lessonId } }))!.status).toBe("ACCEPTED");
    // une famille ne peut ni ouvrir la fiche prof, ni s'inscrire comme professeur
    await A.famille.get("/api/profs/me").expect(403);
    await A.famille.post("/api/profs/me/optin").set(ORIGIN).expect(403);
  });

  it("le prénom d'un entraîneur reste donné par le coach : il n'est pas modifiable par lui", async () => {
    await login("entraineur", Role.TRAINER);
    await A.entraineur.post("/api/profs/me/optin").set(ORIGIN).expect(200);
    await A.entraineur.put("/api/profs/me").set(ORIGIN).send({ firstName: "Autre", lastName: "Nom" }).expect(200);
    expect((await prisma.user.findUnique({ where: { email: "entraineur@exemple.fr" } }))!.firstName).toBe("entraineur");
  });

  it("le coach peut arrêter ses cours : ses cours à venir sont annulés", async () => {
    await A.coach.delete("/api/profs/me").set(ORIGIN).expect(200);
    expect((await prisma.lessonRequest.findUnique({ where: { id: lessonId } }))!.status).toBe("REFUSED");
    expect((await A.adulte.get("/api/profs").expect(200)).body.profs).toEqual([]);
  });
});
