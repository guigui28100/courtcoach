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

describe("Cours particuliers : un entraîneur choisit d'en donner ; documents, visibilité, tarifs, cloisonnement", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  let profId: string, prof2Id: string, p1: string, p2: string, lessonId: string, adultId: string;
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role, extra: object = {}) {
    const email = `${key}@exemple.fr`; const u = await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD), ...extra } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200); return u.id;
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.player.deleteMany(); await prisma.consent.deleteMany(); await prisma.playerAccess.deleteMany(); await prisma.lessonRequest.deleteMany(); await prisma.user.deleteMany(); }
  const upload = (who: string, kind: string, q = "", body: Buffer = PDF) => A[who].put(`/api/profs/me/documents/${kind}?fileName=piece.pdf${q}`).set(ORIGIN).set("Content-Type", "application/octet-stream").send(body);
  const adultList = async () => (await A.adulte.get("/api/profs").expect(200)).body;

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    await login("coach", Role.COACH); adultId = await login("adulte", Role.ADULT); await login("adulte2", Role.ADULT); await login("parent", Role.GUARDIAN);
    await login("comite", Role.TRAINER, { trainerKind: "COMITE" });
    p1 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Léo" }).expect(201)).body.id;
    p2 = (await A.coach.post("/api/players").set(ORIGIN).send({ firstName: "Nina" }).expect(201)).body.id;
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("le coach crée un entraîneur ordinaire ; sans avoir cliqué « je souhaite donner des cours », il n'a aucun accès aux cours particuliers", async () => {
    await A.coach.post("/api/trainers").set(ORIGIN).send({ firstName: "X", email: "x@exemple.fr", kind: "PROF", playerIds: [] }).expect(400); // plus de type « professeur » à la création
    const r = await A.coach.post("/api/trainers").set(ORIGIN).send({ firstName: "Claire", email: "claire@exemple.fr", playerIds: [p1] }).expect(201);
    profId = r.body.id;
    expect((await A.coach.get("/api/trainers").expect(200)).body.find((t: any) => t.id === profId)).toMatchObject({ kind: "COMITE", teaches: false });
    await prisma.user.update({ where: { id: profId }, data: { passwordHash: await hash(PASSWORD), mustChangePassword: false } });
    A.prof = agent(); await A.prof.post("/api/auth/login").set(ORIGIN).send({ email: "claire@exemple.fr", password: PASSWORD }).expect(200);
    prof2Id = await login("prof2", Role.TRAINER);
    for (const who of ["prof", "prof2", "comite"]) {
      expect((await A[who].get("/api/profs/me").expect(200)).body).toMatchObject({ optedIn: false });
      await A[who].get("/api/lessons").expect(403);
      await A[who].put("/api/profs/me").set(ORIGIN).send({ bio: "x" }).expect(403);
      await A[who].put("/api/profs/me/slots").set(ORIGIN).send({ slots: [] }).expect(403);
      await upload(who, "DIPLOME").expect(403);
    }
    await A.comite.get(`/api/profs/${profId}/documents/DIPLOME`).expect(404);
    await A.adulte.post("/api/profs/me/optin").set(ORIGIN).expect(403); // seulement un entraîneur
    await A.parent.post("/api/profs/me/optin").set(ORIGIN).expect(403);
    // l'entraîneur clique « je souhaite donner des cours particuliers » (et aucun adulte ne le voit encore)
    for (const who of ["prof", "prof2"]) expect((await A[who].post("/api/profs/me/optin").set(ORIGIN).expect(200)).body).toMatchObject({ optedIn: true, status: "missing" });
    expect((await A.coach.get("/api/trainers").expect(200)).body.find((t: any) => t.id === profId).teaches).toBe(true);
    expect((await A.prof2.get("/api/lessons").expect(200)).body).toEqual([]);
    await A.comite.get("/api/lessons").expect(403); // l'autre entraîneur n'a toujours rien
  });

  it("le professeur ne voit que les jeunes que le coach lui confie", async () => {
    expect((await A.prof.get("/api/players").expect(200)).body.map((p: any) => p.id)).toEqual([p1]);
    await A.prof.get(`/api/players/${p2}`).expect(404);
    await A.adulte.get("/api/players").expect(403);
  });

  it("le professeur remplit sa présentation et ses disponibilités ; l'adulte ne le voit pas tant que tout n'est pas validé", async () => {
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ lastName: "Dupuis", birthYear: 1992, ranking: "15/1", bestRanking: "4/6", bio: "Débutants bienvenus" }).expect(200);
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ ranking: "<script>" }).expect(400);
    await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [{ weekday: 1, start: "18:00", end: "20:00" }, { date: future(10), start: "09:00", end: "12:00" }] }).expect(200);
    await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [{ weekday: 1, date: future(3), start: "18:00", end: "20:00" }] }).expect(400); // jour ET date
    await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [{ weekday: 1, start: "20:00", end: "18:00" }] }).expect(400); // fin avant début
    await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [{ date: "2020-01-01", start: "09:00", end: "10:00" }] }).expect(400); // date passée
    expect((await A.prof.get("/api/profs/me").expect(200)).body).toMatchObject({ lastName: "Dupuis", status: "missing", slots: [expect.anything(), expect.anything()] });
    expect((await adultList()).profs).toEqual([]);
    await A.coach.post(`/api/profs/${profId}/approval`).set(ORIGIN).send({ approved: true }).expect(400); // il manque les documents
  });

  it("documents : format vérifié, carte pro avec date de validité, tout est refusé si ce n'est pas un PDF ou une photo", async () => {
    await upload("prof", "DIPLOME", "", Buffer.from("MZ\x90\x00 exécutable")).expect(400);
    await upload("prof", "DIPLOME", "", Buffer.from("PK\x03\x04 word/ xl/")).expect(400); // Word / Excel : pas acceptés ici
    await upload("prof", "CARTE_PRO").expect(400); // pas de date de validité
    await upload("prof", "CARTE_PRO", `&validUntil=${future(-5)}`).expect(400); // déjà expirée
    await upload("prof", "AUTRE").expect(400);
    await upload("prof", "DIPLOME").expect(200);
    await upload("prof", "AUTO_ENTREPRENEUR").expect(200);
    const r = await upload("prof", "CARTE_PRO", `&validUntil=${future(300)}`).expect(200);
    expect(r.body.status).toBe("waiting"); expect(r.body.documents).toHaveLength(3);
    expect(JSON.stringify(r.body)).not.toContain("%PDF"); // jamais le contenu dans la fiche
    expect((await adultList()).profs).toEqual([]); // pas validé par le coach
  });

  it("les pièces ne sont lisibles que par le coach et leur propriétaire", async () => {
    await A.coach.get(`/api/profs/${profId}/documents/DIPLOME`).expect(200);
    await A.prof.get(`/api/profs/${profId}/documents/DIPLOME`).expect(200);
    await A.prof2.get(`/api/profs/${profId}/documents/DIPLOME`).expect(404);
    await A.adulte.get(`/api/profs/${profId}/documents/DIPLOME`).expect(403);
    await A.parent.get(`/api/profs/${profId}/documents/CARTE_PRO`).expect(403);
    await A.adulte.get("/api/profs/admin").expect(403);
    await A.prof.get("/api/profs/admin").expect(403);
    await A.prof.post(`/api/profs/${profId}/approval`).set(ORIGIN).send({ approved: true }).expect(403); // il ne se valide pas lui-même
    const admin = (await A.coach.get("/api/profs/admin").expect(200)).body.find((x: any) => x.id === profId);
    expect(admin).toMatchObject({ status: "waiting", email: "claire@exemple.fr" }); expect(admin.documents).toHaveLength(3);
  });

  it("après validation du coach, l'adulte voit le professeur (sans mail, sans documents, âge seulement si le professeur le veut) avec son tarif", async () => {
    await A.coach.post(`/api/profs/${profId}/approval`).set(ORIGIN).send({ approved: true }).expect(200);
    let l = await adultList();
    expect(l.profs).toHaveLength(1); expect(l.profs[0]).toMatchObject({ id: profId, firstName: "Claire", lastName: "Dupuis", ranking: "15/1", bestRanking: "4/6", age: null, paused: false });
    expect(JSON.stringify(l)).not.toMatch(/exemple\.fr|documents|birthYear|1992/);
    expect(l.yourPrice).toBe(50); expect(l.prices).toEqual({ member: 40, other: 50 });
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ showAge: true }).expect(200);
    expect((await adultList()).profs[0].age).toBe(new Date().getFullYear() - 1992);
    await A.parent.get("/api/profs").expect(403); // les familles n'y ont pas accès
    await A.comite.get("/api/profs").expect(403);
  });

  it("demande de cours à un professeur : tarif 50 € ou 40 € si l'adulte est adhérent, figé à la demande ; professeur inconnu ou non visible refusé", async () => {
    await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId: prof2Id }).expect(400); // pas visible
    await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId: "inconnu" }).expect(400);
    const a = (await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId }).expect(201)).body;
    expect(a).toMatchObject({ profId, price: 50, memberDeclared: false }); lessonId = a.id;
    await A.adulte.put("/api/auth/me/profile").set(ORIGIN).send({ clubMember: true }).expect(200);
    expect((await adultList()).yourPrice).toBe(40);
    const b = (await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "duo", objective: "Revers", profId, partnerFirstName: "Paul", partnerLastName: "Durand", partnerAge: 40, partnerLevel: "30" }).expect(201)).body;
    expect(b).toMatchObject({ price: 40, memberDeclared: true });
    expect((await prisma.lessonRequest.findUnique({ where: { id: lessonId } }))!.price).toBe(50); // l'ancien tarif ne change pas
    const sans = (await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Autre" }).expect(201)).body;
    expect(sans.profId).toBeNull(); expect(sans.price).toBeNull(); // sans professeur : demande au coach
  });

  it("le professeur ne voit et ne traite QUE ses demandes ; le coach voit tout ; l'adulte confirme", async () => {
    const mine = (await A.prof.get("/api/lessons").expect(200)).body;
    expect(mine).toHaveLength(2); expect(mine.every((x: any) => x.profId === profId)).toBe(true);
    expect(mine[0].member.email).toBeUndefined(); // pas d'adresse e-mail
    expect(JSON.stringify(mine)).not.toContain("adulte2");
    expect((await A.prof2.get("/api/lessons").expect(200)).body).toEqual([]);
    await A.prof2.post(`/api/lessons/${lessonId}/answer`).set(ORIGIN).send({ status: "REFUSED" }).expect(404);
    const sansProf = (await prisma.lessonRequest.findFirst({ where: { profId: null } }))!;
    await A.prof.post(`/api/lessons/${sansProf.id}/answer`).set(ORIGIN).send({ status: "REFUSED" }).expect(404); // pas SA demande
    await A.prof.post(`/api/lessons/${lessonId}/answer`).set(ORIGIN).send({ status: "PROPOSED", slot: { date: future(5), time: "18:00" }, place: "Court 2" }).expect(200);
    expect((await A.adulte.get("/api/lessons").expect(200)).body.find((x: any) => x.id === lessonId)).toMatchObject({ status: "PROPOSED", prof: { firstName: "Claire" } });
    await A.adulte2.get("/api/lessons").expect(200);
    expect((await A.adulte2.get("/api/lessons").expect(200)).body).toEqual([]); // un autre adulte ne voit rien
    await A.adulte.post(`/api/lessons/${lessonId}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(200);
    await A.prof.post(`/api/lessons/${lessonId}/respond`).set(ORIGIN).send({ action: "confirm" }).expect(403); // seul l'adulte confirme
    await A.prof.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "x" }).expect(403);
    expect((await A.coach.get("/api/lessons").expect(200)).body).toHaveLength(3);
  });

  it("changer un document retire la visibilité jusqu'à nouvelle validation ; pause ; carte expirée", async () => {
    await upload("prof", "DIPLOME").expect(200);
    expect((await adultList()).profs).toEqual([]);
    await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId }).expect(400);
    await A.coach.post(`/api/profs/${profId}/approval`).set(ORIGIN).send({ approved: true }).expect(200);
    expect((await adultList()).profs).toHaveLength(1);
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ paused: true }).expect(200);
    expect((await adultList()).profs[0].paused).toBe(true);
    await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId }).expect(400); // en pause : plus de demande
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ paused: false }).expect(200);
    await prisma.profDocument.update({ where: { userId_kind: { userId: profId, kind: "CARTE_PRO" } }, data: { validUntil: new Date(Date.now() - 86_400_000) } });
    expect((await adultList()).profs).toEqual([]); // carte expirée : retiré tout seul
    await A.coach.post(`/api/profs/${profId}/approval`).set(ORIGIN).send({ approved: true }).expect(400);
  });

  it("arrêter les cours particuliers efface la fiche et les pièces, et renvoie les demandes au coach ; supprimer le compte aussi", async () => {
    await A.prof2.delete("/api/profs/me").set(ORIGIN).expect(200);
    expect((await A.prof2.get("/api/profs/me").expect(200)).body.optedIn).toBe(false);
    await A.prof2.get("/api/lessons").expect(403);
    await A.coach.delete(`/api/trainers/${profId}`).set(ORIGIN).expect(204);
    expect(await prisma.profDocument.count({ where: { userId: profId } })).toBe(0);
    expect(await prisma.profProfile.count({ where: { userId: profId } })).toBe(0);
    expect(await prisma.lessonRequest.count({ where: { profId } })).toBe(0);
    expect(adultId).toBeTruthy();
  });
});
