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
    // la carte montre les 3 prochains créneaux libres et le nombre de créneaux libres cette semaine (sans dire par qui les autres sont pris)
    expect(Array.isArray(l.profs[0].nextFree)).toBe(true); expect(l.profs[0].nextFree.length).toBeLessThanOrEqual(3); expect(typeof l.profs[0].freeThisWeek).toBe("number");
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

  it("planning : créneaux d'une heure sur les disponibilités, réservation immédiate, jamais deux cours au même moment, annulation qui libère", async () => {
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ skipHolidays: false }).expect(200); // ce test réserve aussi pendant les vacances
    await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "08:00", end: "20:00" })) }).expect(200);
    const plan = async (who = "adulte") => (await A[who].get(`/api/profs/${profId}/planning`).expect(200)).body.days as { date: string; slots: { time: string; end: string; free: boolean }[] }[];
    const days = await plan();
    expect(days.length).toBeGreaterThan(20); expect(days.length).toBeLessThanOrEqual(29);
    const d1 = days.find((d) => d.slots.filter((s) => s.free).length >= 3)!; const [s1, s2, s3] = d1.slots.filter((s) => s.free);
    expect(s1.end).toBe(`${String(Number(s1.time.slice(0, 2)) + 1).padStart(2, "0")}:00`); // une heure
    const day = d1.date; const book = (who: string, time: string, extra: object = {}) => A[who].post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId, slot: { date: day, time }, ...extra });
    // adulte2 réserve : le créneau est mis de côté, le professeur doit confirmer, tarif figé
    const b = (await book("adulte2", s1.time).expect(201)).body;
    expect(b).toMatchObject({ status: "BOOKED", price: 50, finalSlot: { date: day, time: s1.time }, profId }); expect(b.confirmedAt).toBeNull();
    // le créneau est pris pour tout le monde (sans dire par qui)
    const after = await plan(); const taken = after.find((d) => d.date === day)!.slots.find((s) => s.time === s1.time)!;
    expect(taken.free).toBe(false); expect(JSON.stringify(after)).not.toMatch(/adulte2|Durand|member/);
    await book("adulte", s1.time).expect(409);
    await book("adulte", "03:00").expect(400); // pas dans les disponibilités
    await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", slot: { date: day, time: s2.time } }).expect(400); // sans professeur
    await book("adulte", s2.time, { profId: prof2Id }).expect(400); // professeur non visible
    expect((await A.adulte.get("/api/lessons").expect(200)).body.every((l: any) => l.id !== b.id)).toBe(true); // la réservation d'un autre n'apparaît pas
    // le professeur ne peut pas proposer une date qui chevauche un cours déjà placé
    await A.prof.post(`/api/lessons/${lessonId}/answer`).set(ORIGIN).send({ status: "PROPOSED", slot: { date: day, time: s1.time } }).expect(409);
    // deux clics en même temps : un seul gagne
    const race = await Promise.all([book("adulte", s2.time), book("adulte2", s2.time)]);
    expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
    // personne d'autre ne peut annuler un cours qui n'est pas le sien ; l'adulte annule le sien : le créneau se libère
    await A.adulte2.post(`/api/lessons/${race.find((r) => r.status === 201)!.body.id}/cancel`).set(ORIGIN).then((r) => expect([200, 404]).toContain(r.status));
    await A.adulte2.post(`/api/lessons/${b.id}/cancel`).set(ORIGIN).expect(200);
    expect((await prisma.lessonRequest.findUnique({ where: { id: b.id } }))).toMatchObject({ status: "REFUSED", slotKey: null });
    expect((await plan()).find((d) => d.date === day)!.slots.find((s) => s.time === s1.time)!.free).toBe(true);
    await A.adulte2.post(`/api/lessons/${b.id}/cancel`).set(ORIGIN).expect(404); // déjà annulé
    // le professeur voit la réservation, l'annule : le créneau se libère encore
    const c = (await book("adulte", s1.time).expect(201)).body;
    expect((await A.prof.get("/api/lessons").expect(200)).body.some((l: any) => l.id === c.id)).toBe(true);
    await A.prof.post(`/api/lessons/${c.id}/answer`).set(ORIGIN).send({ status: "REFUSED", reply: "Désolé, imprévu" }).expect(200);
    await book("adulte2", s1.time).expect(201);
    // confirmation : le professeur du cours (ou le coach) seulement ; ni l'adulte, ni un autre professeur
    const d = (await book("adulte2", s3.time).expect(201)).body; // adulte2 (réservation précédente de s1 est à adulte2 aussi : s3 est libre)
    await A.adulte2.post(`/api/lessons/${d.id}/confirm`).set(ORIGIN).expect(403);
    await A.prof2.post(`/api/lessons/${d.id}/confirm`).set(ORIGIN).expect(404); // un autre professeur ne voit pas ce cours
    await A.parent.post(`/api/lessons/${d.id}/confirm`).set(ORIGIN).expect(403);
    const ok = (await A.prof.post(`/api/lessons/${d.id}/confirm`).set(ORIGIN).expect(200)).body;
    expect(ok).toMatchObject({ status: "ACCEPTED" }); expect(ok.confirmedAt).toBeTruthy(); expect(ok.seenByMemberAt).toBeNull();
    await A.prof.post(`/api/lessons/${d.id}/confirm`).set(ORIGIN).expect(404); // déjà confirmé
    // sans réponse sous 48 h : le créneau est libéré et l'adulte est prévenu
    const old = await prisma.lessonRequest.findFirstOrThrow({ where: { profId, status: "BOOKED" } });
    await prisma.lessonRequest.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 49 * 3_600_000) } });
    const slotOld = old.finalSlot as { date: string; time: string };
    const freed = (await plan()).find((x) => x.date === slotOld.date)!.slots.find((x) => x.time === slotOld.time)!;
    expect(freed.free).toBe(true);
    expect(await prisma.lessonRequest.findUnique({ where: { id: old.id } })).toMatchObject({ status: "REFUSED", slotKey: null });
    // « toute l'année » : le même créneau chaque semaine jusqu'au 30 juin, une seule confirmation, le professeur peut tout arrêter
    const far = days.filter((x) => x.slots.some((y) => y.time === "17:00" && y.free))[10]; expect(far).toBeTruthy();
    const w = (await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId, weekly: true, slot: { date: far.date, time: "17:00" } }).expect(201)).body;
    expect(w.status).toBe("BOOKED"); expect(w.seriesCount).toBeGreaterThan(8); expect(Array.isArray(w.skipped)).toBe(true);
    const rowsOf = () => prisma.lessonRequest.findMany({ where: { seriesId: w.seriesId }, orderBy: { slotKey: "asc" } });
    const serie = await rowsOf(); expect(serie.length).toBe(w.seriesCount); expect(new Set(serie.map((r) => r.profId)).size).toBe(1); expect(serie.every((r) => r.status === "BOOKED" && !!r.slotKey)).toBe(true);
    await A.adulte.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", weekly: true, slot: { date: far.date, time: "17:00" } }).expect(400); // sans professeur
    await A.adulte2.post("/api/lessons").set(ORIGIN).send({ type: "individuel", objective: "Service", profId, weekly: true, slot: { date: far.date, time: "17:00" } }).expect(409); // premier créneau déjà pris
    await A.adulte2.post(`/api/lessons/${w.id}/stop-series`).set(ORIGIN).expect(403); // pas à l'adulte
    await A.prof2.post(`/api/lessons/${w.id}/stop-series`).set(ORIGIN).expect(404); // pas à un autre professeur
    await A.prof.post(`/api/lessons/${w.id}/confirm`).set(ORIGIN).expect(200); // une seule confirmation
    expect((await rowsOf()).every((r) => r.status === "ACCEPTED")).toBe(true);
    await A.adulte.post(`/api/lessons/${serie[1].id}/cancel`).set(ORIGIN).send({}).expect(200); // un seul cours annulé
    let rowsNow = await rowsOf(); expect(rowsNow.filter((r) => r.status === "REFUSED").length).toBe(1);
    const stop = (await A.prof.post(`/api/lessons/${serie[0].id}/stop-series`).set(ORIGIN).send({ reply: "Imprévu, désolé" }).expect(200)).body;
    expect(stop.stopped).toBe(serie.length - 1); rowsNow = await rowsOf();
    expect(rowsNow.every((r) => r.status === "REFUSED" && r.slotKey === null)).toBe(true); // créneaux libérés
    expect((await plan()).find((x) => x.date === far.date)!.slots.find((x) => x.time === "17:00")!.free).toBe(true);
    // le professeur actualise ses disponibilités : les cours déjà confirmés qui n'y tombent plus sont signalés (rien n'est annulé)
    const other = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7 + 3) % 7;
    const upd = (await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [{ weekday: other, start: "08:00", end: "10:00" }] }).expect(200)).body;
    expect(upd.outsideCount).toBeGreaterThanOrEqual(1); expect(upd.updatedAt).toBeTruthy();
    expect(await prisma.lessonRequest.findUnique({ where: { id: d.id } })).toMatchObject({ status: "ACCEPTED" });
    await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "08:00", end: "20:00" })) }).expect(200);
    // accès : adultes et coach seulement ; une famille et un entraîneur non
    await A.coach.get(`/api/profs/${profId}/planning`).expect(200);
    for (const who of ["parent", "comite", "prof2"]) await A[who].get(`/api/profs/${profId}/planning`).expect(403);
    await A.adulte.get("/api/profs/inconnu/planning").expect(400);
    // en pause : plus de planning
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ paused: true }).expect(200);
    await A.adulte.get(`/api/profs/${profId}/planning`).expect(400);
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ paused: false }).expect(200);
  });

  it("séries : les vacances scolaires et les jours fériés sont sautés, jusqu'au 30 juin", async () => {
    const { seriesDates, seasonEnd } = await import("../src/profs/series");
    expect(seasonEnd("2026-10-21")).toBe("2027-06-30"); expect(seasonEnd("2027-03-01")).toBe("2027-06-30"); expect(seasonEnd("2027-09-15")).toBe("2028-06-30");
    const d = seriesDates("2026-10-21"); expect(d[d.length - 1].date <= "2027-06-30").toBe(true);
    expect(d.find((x) => x.date === "2026-10-28")?.skip).toMatch(/vacances scolaires/); // Toussaint
    expect(d.find((x) => x.date === "2026-12-23")?.skip).toMatch(/vacances scolaires/); // Noël
    expect(d.find((x) => x.date === "2026-11-11")?.skip).toMatch(/jour férié/); // 11 novembre (mercredi)
    expect(seriesDates("2027-05-05").find((x) => x.date === "2027-05-05")?.skip).toBeUndefined();
    expect(seriesDates("2027-05-06")[0].skip).toMatch(/Ascension/);
  });

  it("pas de cours en vacances : la case du professeur change le planning", async () => {
    await A.prof.put("/api/profs/me/slots").set(ORIGIN).send({ slots: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "08:00", end: "20:00" })) }).expect(200);
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ skipHolidays: true }).expect(200);
    expect((await A.prof.get("/api/profs/me").expect(200)).body.skipHolidays).toBe(true);
    const { offDay } = await import("../src/profs/holidays");
    const plan = (await A.adulte.get(`/api/profs/${profId}/planning`).expect(200)).body.days as { date: string }[];
    expect(plan.some((d) => offDay(d.date))).toBe(false); // aucun jour de vacances ni férié proposé
    await A.prof.put("/api/profs/me").set(ORIGIN).send({ skipHolidays: false }).expect(200);
    const open = (await A.adulte.get(`/api/profs/${profId}/planning`).expect(200)).body.days as { date: string }[];
    expect(open.length).toBeGreaterThan(plan.length); // la case décochée rouvre les vacances (si une vacance tombe dans les 28 jours)
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
    // le professeur arrête tout : ses cours à venir (confirmés ou réservés) sont annulés, les créneaux libérés, l'adulte est prévenu ; les cours passés restent
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10), past = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    const mk = (status: "ACCEPTED" | "BOOKED", date: string) => prisma.lessonRequest.create({ data: { memberId: adultId, type: "individuel", objective: "Service", profId, status, finalSlot: { date, time: "18:00" }, slotKey: `${date}T18:00` } });
    const [lf, lb, lp] = [await mk("ACCEPTED", future), await mk("BOOKED", new Date(Date.now() + 11 * 86_400_000).toISOString().slice(0, 10)), await mk("ACCEPTED", past)];
    await A.prof.delete("/api/profs/me").set(ORIGIN).expect(200);
    for (const l of [lf, lb]) { const r = await prisma.lessonRequest.findUnique({ where: { id: l.id } }); expect(r).toMatchObject({ status: "REFUSED", slotKey: null }); expect(r!.coachReply).toMatch(/arrêté les cours particuliers/); expect(r!.seenByMemberAt).toBeNull(); }
    expect(await prisma.lessonRequest.findUnique({ where: { id: lp.id } })).toMatchObject({ status: "ACCEPTED" }); // un cours passé reste
    await A.coach.delete(`/api/trainers/${profId}`).set(ORIGIN).expect(204);
    expect(await prisma.profDocument.count({ where: { userId: profId } })).toBe(0);
    expect(await prisma.profProfile.count({ where: { userId: profId } })).toBe(0);
    expect(await prisma.lessonRequest.count({ where: { profId } })).toBe(0);
    expect(adultId).toBeTruthy();
  });
});
