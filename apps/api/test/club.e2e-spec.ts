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

describe("Planning du club (réservé au coach)", () => {
  let app: INestApplication; let prisma: PrismaService; const A: Record<string, ReturnType<typeof request.agent>> = {};
  const agent = () => request.agent(app.getHttpServer());
  async function login(key: string, role: Role) {
    const email = `${key}@exemple.fr`; await prisma.user.create({ data: { email, role, firstName: key, passwordHash: await hash(PASSWORD) } });
    A[key] = agent(); await A[key].post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
  }
  async function clean() { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.clubEvent.deleteMany(); await prisma.clubSetting.deleteMany(); await prisma.lessonRequest.deleteMany(); await prisma.user.deleteMany(); }
  const ev = (o: object = {}) => ({ kind: "TOURNOI", startDate: "2026-10-10", endDate: "2026-10-11", courts: [1, 2, 3, 4], ...o });

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService); await clean();
    for (const [k, r] of [["coach", Role.COACH], ["adulte", Role.ADULT], ["entraineur", Role.TRAINER], ["parent", Role.GUARDIAN], ["jeune", Role.YOUTH]] as [string, Role][]) await login(k, r);
  });
  afterAll(async () => { await clean(); await app.close(); });

  it("seul le coach ouvre le planning ; adultes, entraîneurs, familles et jeunes n'ont AUCUN accès", async () => {
    for (const k of ["adulte", "entraineur", "parent", "jeune"]) {
      await A[k].get("/api/club/plan").expect(403);
      await A[k].post("/api/club/events").set(ORIGIN).send(ev()).expect(403);
      await A[k].put("/api/club/teams").set(ORIGIN).send({ counts: {} }).expect(403);
      await A[k].put("/api/club/people").set(ORIGIN).send({ people: [] }).expect(403);
      await A[k].delete("/api/club/events/x").set(ORIGIN).expect(403);
      await A[k].put("/api/club/events-order").set(ORIGIN).send({ ids: ["a", "b"] }).expect(403);
    }
    await request(app.getHttpServer()).get("/api/club/plan").expect(401);
    const r = (await A.coach.get("/api/club/plan").expect(200)).body;
    expect(r.events).toEqual([]); expect(r.teamCounts).toMatchObject({ "sen-m": 3, "vet-45-d": 2, "gar-13-14": 2 });
  });

  it("le coach place, modifie et supprime des événements ; les données sont vérifiées", async () => {
    const t = (await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ title: "Tournoi jeunes U12", who: ["Guillaume"] })).expect(201)).body;
    expect(t).toMatchObject({ kind: "TOURNOI", courts: [1, 2, 3, 4], bands: [], title: "Tournoi jeunes U12", who: ["Guillaume"] });
    await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ kind: "NOPE" })).expect(400);
    await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ startDate: "2026-02-30" })).expect(400);
    await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ endDate: "2026-10-01" })).expect(400); // fin avant début
    await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ courts: [5] })).expect(400);
    await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ courts: [], startDate: "2026-12-01", endDate: "2026-12-01" })).expect(201); // les terrains sont facultatifs
    await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ bands: ["NUIT"] })).expect(400);
    const u = (await A.coach.put(`/api/club/events/${t.id}`).set(ORIGIN).send(ev({ title: "Tournoi U12", courts: [3, 4] })).expect(200)).body;
    expect(u.courts).toEqual([3, 4]);
    await A.coach.delete(`/api/club/events/${t.id}`).set(ORIGIN).expect(200);
    await A.coach.delete(`/api/club/events/${t.id}`).set(ORIGIN).expect(404);
    await A.coach.put(`/api/club/events/${t.id}`).set(ORIGIN).send(ev()).expect(404);
  });

  it("plusieurs événements le même jour : possible tant que le même court n'est pas pris au même moment", async () => {
    await A.coach.post("/api/club/events").set(ORIGIN).send(ev({ courts: [1, 2], title: "Tournoi" })).expect(201); // courts 1-2, toute la journée
    // match par équipes sur les courts 3-4 le même jour : OK
    const m = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-10-10", endDate: "2026-10-10", bands: ["APRES_MIDI"], courts: [3, 4], teams: ["sen-m#1"] }).expect(201)).body;
    // même court 1 à ce moment-là : refusé (409) avec le détail
    const c = await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-10-10", endDate: "2026-10-10", bands: ["MATIN"], courts: [1], teams: ["sen-m#2"] }).expect(409);
    expect(c.body.clashes[0]).toMatchObject({ why: expect.stringContaining("court 1") });
    // la même équipe ne joue pas deux fois en même temps
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-10-10", endDate: "2026-10-10", bands: ["APRES_MIDI"], courts: [4], teams: ["sen-m#1"] }).expect(409);
    // même court mais un autre moment : OK
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-10-10", endDate: "2026-10-10", bands: ["SOIR"], courts: [3], teams: ["sen-m#2"] }).expect(201);
    // le coach peut forcer
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-10-10", endDate: "2026-10-10", bands: ["MATIN"], courts: [1], teams: ["sen-m#3"], allowConflict: true }).expect(201);
    expect(m.id).toBeTruthy();
  });

  it("équipes : seulement celles de « Mes équipes » ; le nombre d'équipes se règle", async () => {
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-11-08", endDate: "2026-11-08", courts: [1], teams: ["vet-45-d#3"] }).expect(400); // 2 équipes seulement
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-11-08", endDate: "2026-11-08", courts: [1], teams: ["zzz-12#1"] }).expect(400);
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-11-08", endDate: "2026-11-08", courts: [1] }).expect(400); // aucune équipe
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-08", endDate: "2026-11-08", courts: [1], teams: ["sen-m#1"] }).expect(400);
    expect((await A.coach.put("/api/club/teams").set(ORIGIN).send({ counts: { "vet-45-d": 3 } }).expect(200)).body["vet-45-d"]).toBe(3);
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "EQUIPES", startDate: "2026-11-08", endDate: "2026-11-08", courts: [1], teams: ["vet-45-d#3"] }).expect(201);
    await A.coach.put("/api/club/teams").set(ORIGIN).send({ counts: { "vet-45-d": 9 } }).expect(400);
    await A.coach.put("/api/club/teams").set(ORIGIN).send({ counts: { inconnue: 2 } }).expect(400);
  });

  it("personnes à affecter : bénévoles, bureau, professeurs ; noms vérifiés, coach seul", async () => {
    const r = (await A.coach.put("/api/club/people").set(ORIGIN).send({ people: [{ name: "Marc Leroy", role: "PRESIDENT" }, { name: "  Anne  Dupont ", role: "BENEVOLE" }, { name: "Paul Martin", role: "BUREAU" }] }).expect(200)).body;
    expect(r).toEqual([{ name: "Marc Leroy", role: "PRESIDENT" }, { name: "Anne Dupont", role: "BENEVOLE" }, { name: "Paul Martin", role: "BUREAU" }]);
    expect((await A.coach.get("/api/club/plan").expect(200)).body.people).toHaveLength(3);
    await A.coach.put("/api/club/people").set(ORIGIN).send({ people: [{ name: "Anne", role: "BENEVOLE" }, { name: "anne", role: "BUREAU" }] }).expect(400); // doublon
    await A.coach.put("/api/club/people").set(ORIGIN).send({ people: [{ name: "Zoé", role: "CHEF" }] }).expect(400);
    await A.coach.put("/api/club/people").set(ORIGIN).send({ people: [{ name: "   ", role: "BUREAU" }] }).expect(400);
    const e = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "INSCRIPTIONS", startDate: "2026-09-05", endDate: "2026-09-05", who: ["Anne Dupont", "Paul Martin"] }).expect(201)).body;
    expect(e.who).toEqual(["Anne Dupont", "Paul Martin"]);
    const d = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", note: "Tournoi interne, goûter offert." }).expect(201)).body;
    expect(d.note).toBe("Tournoi interne, goûter offert."); // description libre
    expect(d.featured).toBe(false);
    const f = (await A.coach.put(`/api/club/events/${d.id}`).set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", featured: true }).expect(200)).body;
    expect(f.featured).toBe(true); // « ⭐ à mettre en avant »
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", note: "x".repeat(601) }).expect(400);
    // Infos de l'affiche : horaires, lieu, inscriptions et plusieurs formules avec leur prix
    const g = (await A.coach.put(`/api/club/events/${d.id}`).set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", featured: true, time: "9 h – 18 h", place: "Courts couverts", signup: "À l'accueil jusqu'au 10 novembre", formulas: [{ label: "Adhérent", price: "10 €", priceMember: "", detail: "repas compris", group: "6 à 17 ans" }, { label: "Non adhérent", price: "15 €", priceMember: "12 €" }, { label: "  ", price: "  " }], audience: "8 à 12 ans", bring: "Tenue de sport" }).expect(200)).body;
    expect(g.audience).toBe("8 à 12 ans"); expect(g.bring).toBe("Tenue de sport");
    expect(g.time).toBe("9 h – 18 h"); expect(g.place).toBe("Courts couverts"); expect(g.signup).toContain("10 novembre");
    expect(g.formulas).toEqual([{ label: "Adhérent", price: "10 €", priceMember: "", detail: "repas compris", group: "6 à 17 ans" }, { label: "Non adhérent", price: "15 €", priceMember: "12 €", detail: "", group: "" }]); // la ligne vide est ignorée
    const h = (await A.coach.put(`/api/club/events/${d.id}`).set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", featured: false }).expect(200)).body;
    expect(h.formulas).toHaveLength(2); expect(h.time).toBe("9 h – 18 h"); expect(h.audience).toBe("8 à 12 ans"); // un simple ⭐ ne supprime pas les infos de l'affiche
    await A.coach.put(`/api/club/events/${d.id}`).set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", formulas: Array.from({ length: 9 }, (_, i) => ({ label: `F${i}`, price: "1 €" })) }).expect(400); // 8 au plus
    await A.coach.put(`/api/club/events/${d.id}`).set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", time: "x".repeat(601) }).expect(400);
    // horaires jour par jour (une ligne par jour) : jusqu'à 600 caractères, les retours à la ligne sont gardés
    const jj = "Samedi 14 : 9 h – 19 h\nDimanche 15 : 9 h – 18 h";
    const j2 = (await A.coach.put(`/api/club/events/${d.id}`).set(ORIGIN).send({ kind: "TOURNOI", startDate: "2026-11-14", endDate: "2026-11-15", time: jj }).expect(200)).body;
    expect(j2.time).toBe(jj);
  });

  it("bulles : un décor qui ne gêne pas les événements ; la réfection de terre battue attend le démontage", async () => {
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "BULLE", startDate: "2026-09-01", endDate: "2027-05-09", courts: [1, 2], title: "Bulle courts 1-2" }).expect(201);
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "BULLE", startDate: "2026-09-01", endDate: "2027-05-09", courts: [3, 4], title: "Bulle courts 3-4" }).expect(201);
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "BULLE", startDate: "2027-01-01", endDate: "2027-01-31", courts: [1] }).expect(409); // deux bulles sur le court 1
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "STAGE_ENFANTS", startDate: "2026-10-19", endDate: "2026-10-23", courts: [3, 4] }).expect(201); // sous la bulle : OK
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "TERRE_BATTUE", startDate: "2027-04-01", endDate: "2027-04-10", courts: [1, 2] }).expect(409); // bulle encore montée
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "TERRE_BATTUE", startDate: "2027-05-17", endDate: "2027-06-04", courts: [1, 2] }).expect(201); // après le démontage
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "TERRE_BATTUE", startDate: "2027-06-10", endDate: "2027-06-12", courts: [3] }).expect(400); // courts en dur : pas de réfection
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", startDate: "2026-11-14", endDate: "2026-11-14", title: "Fête du club" }).expect(201); // sans court
    for (const kind of ["BULLE_MONTAGE_TB", "BULLE_MONTAGE_QUICK", "BULLE_DEMONTAGE_TB", "BULLE_DEMONTAGE_QUICK", "BULLE_MONTAGE", "BULLE_DEMONTAGE", "INSCRIPTIONS", "FETE", "FETE_ECOLE", "JUMELAGE", "MAINT_BULLE_TB", "MAINT_BULLE_QUICK", "DEBUT_COURS", "FIN_COURS", "AG", "AGE", "AUTRE"]) await A.coach.post("/api/club/events").set(ORIGIN).send({ kind, startDate: "2026-09-05", endDate: "2026-09-05" }).expect(201);
  });

  it("ordre des événements d'une case : le coach les glisse au-dessus ou en dessous d'un autre", async () => {
    await prisma.clubEvent.deleteMany(); // sans effacer les comptes (le coach reste connecté)
    const a = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", title: "A", startDate: "2026-12-05", endDate: "2026-12-05" }).expect(201)).body;
    const b = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", title: "B", startDate: "2026-12-05", endDate: "2026-12-05" }).expect(201)).body;
    const c = (await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", title: "C", startDate: "2026-12-05", endDate: "2026-12-05" }).expect(201)).body;
    const titles = async () => (await A.coach.get("/api/club/plan").expect(200)).body.events.map((x: { title: string }) => x.title);
    expect(await titles()).toEqual(["A", "B", "C"]);
    await A.coach.put("/api/club/events-order").set(ORIGIN).send({ ids: [c.id, a.id, b.id] }).expect(200);
    expect(await titles()).toEqual(["C", "A", "B"]);
    await A.coach.put("/api/club/events-order").set(ORIGIN).send({ ids: [c.id] }).expect(400); // un seul événement : rien à ordonner
    await A.coach.put("/api/club/events-order").set(ORIGIN).send({ ids: [c.id, "inconnu"] }).expect(404);
    await A.coach.put("/api/club/events-order").set(ORIGIN).send({ ids: "x" }).expect(400);
  });

  it("« Mon planning » : chacun ne voit que les événements où il est placé, et écrit ses propres jours de cours", async () => {
    for (const k of ["adulte", "parent", "jeune"]) { await A[k].get("/api/club/mine").expect(403); await A[k].get("/api/club/my-schedule").expect(403); }
    await request(app.getHttpServer()).get("/api/club/mine").expect(401);
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", startDate: "2099-05-01", endDate: "2099-05-01", courts: [], who: ["Entraineur"], time: "10 h", place: "Court 1" }).expect(201);
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", startDate: "2099-05-02", endDate: "2099-05-02", courts: [], who: ["Quelqu'un d'autre"] }).expect(201);
    await A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", startDate: "2001-05-02", endDate: "2001-05-02", courts: [], who: ["entraineur"] }).expect(201);
    const mine = (await A.entraineur.get("/api/club/mine").expect(200)).body;
    expect(mine).toHaveLength(1); expect(mine[0].startDate).toBe("2099-05-01"); expect(mine[0].time).toBe("10 h"); expect(mine[0].who).toBeUndefined();
    expect((await A.coach.get("/api/club/mine").expect(200)).body).toHaveLength(0);
    for (const k of ["adulte", "parent", "jeune", "entraineur"]) await A[k].get("/api/club/staff").expect(403);
    const staff = (await A.coach.get("/api/club/staff").expect(200)).body; expect(staff.map((x: any) => x.role).sort()).toEqual(["COACH", "TRAINER"]); expect(staff[0].email).toBeUndefined();
    const tid = (await prisma.user.findFirstOrThrow({ where: { email: "entraineur@exemple.fr" } })).id;
    await A.entraineur.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [] }).expect(403); // l'entraîneur ne place pas ses jours lui-même
    await A.entraineur.put("/api/club/my-schedule").set(ORIGIN).send({ items: [] }).expect(404);
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 2, start: "14:00", end: "16:00", label: "École de tennis" }] }).expect(200);
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 2, start: "16:00", end: "14:00" }] }).expect(400);
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 9, start: "14:00", end: "16:00" }] }).expect(400);
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 1, start: "18:00", end: "20:00", label: "Compétition jeunes", kind: "COMPETITION" }] }).expect(200);
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 1, start: "18:00", end: "20:00", kind: "AUTRE" }] }).expect(400);
    expect((await A.entraineur.get("/api/club/my-schedule").expect(200)).body[0].kind).toBe("COMPETITION");
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 2, start: "14:00", end: "16:00", label: "École de tennis" }] }).expect(200);
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 1, start: "09:30", end: "11:00", label: "Cours adultes", kind: "ADULTES" }, { weekday: 1, start: "11:00", end: "12:30", label: "École de tennis", kind: "ECOLE" }] }).expect(200); // demi-heure et bout à bout : permis
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 1, start: "09:30", end: "11:00", kind: "ADULTES" }, { weekday: 1, start: "10:30", end: "12:00", kind: "ECOLE" }] }).expect(400); // chevauchement
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 1, start: "09:10", end: "10:40", kind: "ADULTES" }] }).expect(400); // ni heure ni demi-heure
    await A.coach.put(`/api/club/schedule/${tid}`).set(ORIGIN).send({ items: [{ weekday: 1, start: "09:30", end: "11:00", label: "Cours adultes", kind: "ADULTES" }, { weekday: 2, start: "09:30", end: "11:00", label: "Cours adultes", kind: "ADULTES" }] }).expect(200); // même heure, autre jour : permis
    await A.coach.put("/api/club/schedule/inconnu").set(ORIGIN).send({ items: [] }).expect(404);
    expect((await A.entraineur.get("/api/club/my-schedule").expect(200)).body).toHaveLength(2);
    expect((await A.coach.get("/api/club/my-schedule").expect(200)).body).toHaveLength(0);
  });

  it("un événement où un prof est coché arrive dans son agenda et dans le « Planning des profs » (noms reconnus avec ou sans nom de famille, accents et majuscules ignorés)", async () => {
    const tid = (await prisma.user.findFirstOrThrow({ where: { email: "entraineur@exemple.fr" } })).id;
    await prisma.clubEvent.deleteMany();
    await prisma.user.update({ where: { id: tid }, data: { firstName: "Théo", lastName: null } });
    const mk = (who: string[], d: string) => A.coach.post("/api/club/events").set(ORIGIN).send({ kind: "ANIMATION", startDate: d, endDate: d, courts: [], who }).expect(201);
    await mk(["THEO"], "2099-06-01"); await mk(["Théo Martin"], "2099-06-02"); await mk(["theo (moi)"], "2099-06-03"); await mk(["Marc Dupont"], "2099-06-04");
    expect((await A.entraineur.get("/api/club/mine").expect(200)).body.map((e: any) => e.startDate)).toEqual(["2099-06-01", "2099-06-02", "2099-06-03"]);
    await prisma.user.update({ where: { id: tid }, data: { lastName: "Durand" } });
    expect((await A.entraineur.get("/api/club/mine").expect(200)).body.map((e: any) => e.startDate)).toEqual(["2099-06-01", "2099-06-03"]); // « Théo Martin » n'est pas lui
    await mk(["Théo Durand"], "2099-06-05");
    const forCoach = (await A.coach.get(`/api/club/events-of/${tid}`).expect(200)).body;
    expect(forCoach.map((e: any) => e.startDate)).toEqual(["2099-06-01", "2099-06-03", "2099-06-05"]);
    for (const k of ["adulte", "parent", "jeune", "entraineur"]) await A[k].get(`/api/club/events-of/${tid}`).expect(403);
    await A.coach.get("/api/club/events-of/inconnu").expect(404);
    expect((await A.coach.get("/api/club/staff").expect(200)).body.find((x: any) => x.id === tid)).toMatchObject({ firstName: "Théo", lastName: "Durand" });
    await prisma.user.update({ where: { id: tid }, data: { firstName: "entraineur", lastName: null } });
  });
});
