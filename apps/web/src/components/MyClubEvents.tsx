import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, put } from "../api";
import { useAuth } from "../auth";
import { ClubEvent, colorOf, fmtRange, kindOf, titleOf } from "../clubPlan";
import { PageHead, Page } from "./ui";
import { adultName, Lesson, todayIso } from "../types";

type Mine = Pick<ClubEvent, "id" | "kind" | "title" | "startDate" | "endDate" | "bands" | "courts" | "teams" | "time" | "place" | "audience" | "note">;
// Ce qui change pour la personne : si la date, l'heure ou le lieu bougent, l'événement redevient « modifié »
const sig = (e: Mine) => [e.startDate, e.endDate, e.time, e.place, e.title, e.audience].join("|");
const key = (id?: string) => `cc-club-vu-${id ?? ""}`;
const read = (id?: string): Record<string, string> => { try { return JSON.parse(localStorage.getItem(key(id)) || "{}"); } catch { return {}; } };

// Les événements du planning du club où la personne est placée (« Qui s'en occupe ? »), avec ce qui est nouveau ou modifié depuis sa dernière visite.
export function useMyClubEvents() {
  const { me } = useAuth();
  const [list, setList] = useState<Mine[] | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>(() => read(me?.id));
  useEffect(() => {
    if (!me) return;
    setSeen(read(me.id));
    get<Mine[]>("/club/mine").then(setList).catch(() => setList([]));
  }, [me]);
  const state = (e: Mine): "nouveau" | "modifie" | "vu" => (seen[e.id] === undefined ? "nouveau" : seen[e.id] !== sig(e) ? "modifie" : "vu");
  const markSeen = useCallback((es: Mine[]) => {
    const next = { ...seen };
    for (const e of es) next[e.id] = sig(e);
    try { localStorage.setItem(key(me?.id), JSON.stringify(next)); } catch { /* pas grave */ }
    setSeen(next);
  }, [seen, me]);
  const fresh = (list ?? []).filter((e) => state(e) !== "vu");
  return { list, fresh, state, markSeen };
}

// Petit bandeau « tu as été placé sur … » pour l'accueil
export function ClubNotice() {
  const { fresh } = useMyClubEvents();
  if (fresh.length === 0) return null;
  return (
    <Link to="/mes-evenements" className="mb-4 flex items-center gap-3 rounded border-2 border-champagne bg-[#fff6dd] px-4 py-3 text-ink no-underline hover:bg-[#ffefc2]">
      <span aria-hidden="true" className="text-2xl">🔔</span>
      <span className="min-w-0 flex-1"><b>Tu as été placé sur {fresh.length} événement{fresh.length > 1 ? "s" : ""} du club.</b> <span className="text-muted">Touche pour voir les dates.</span></span>
      <span className="shrink-0 font-bold">Voir →</span>
    </Link>
  );
}

interface Course { weekday: number; start: string; end: string; label: string }
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const wd = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
const addDay = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

// Jours de cours habituels : c'est le COACH qui les place (jour, heure de début et de fin, nom facultatif) ; la personne les voit dans son planning
function Schedule({ userId, items, readOnly, onSaved }: { userId: string; items: Course[]; readOnly: boolean; onSaved: (c: Course[]) => void }) {
  const [day, setDay] = useState(2);
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("16:00");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  async function save(next: Course[]) {
    setErr("");
    try { onSaved(await put<Course[]>(`/club/schedule/${userId}`, { items: next })); } catch (x) { setErr((x as Error).message || "Impossible d'enregistrer."); }
  }
  const sorted = [...items].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  return (
    <div>
      {sorted.length === 0 && <p className="m-0 mt-2 text-sm text-muted">{readOnly ? "Le coach n'a pas encore placé tes cours de la semaine." : "Aucun cours placé pour le moment."}</p>}
      {sorted.length > 0 && <ul className="m-0 mt-3 grid list-none gap-1 p-0">{sorted.map((c) => (
        <li key={`${c.weekday}${c.start}`} className="flex flex-wrap items-center gap-2 border-t border-line py-1.5"><b className="w-24">{DAYS[c.weekday]}</b><span>{c.start.replace(":", " h ")} – {c.end.replace(":", " h ")}</span><span className="min-w-0 flex-1 text-muted">{c.label}</span>
          {!readOnly && <button className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={() => save(items.filter((x) => x !== c))}>🗑️ Retirer</button>}</li>))}</ul>}
      {!readOnly && <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-bold">Jour<select className="input" value={day} onChange={(e) => setDay(+e.target.value)}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">De<input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="grid gap-1 text-sm font-bold">À<input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <label className="grid min-w-40 flex-1 gap-1 text-sm font-bold">Nom du cours (facultatif)<input className="input" maxLength={60} placeholder="ex. École de tennis" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <button className="btn-ink" onClick={() => save([...items, { weekday: day, start, end, label: label.trim() }])}>＋ Ajouter</button>
      </div>}
      {err && <p role="alert" className="m-0 mt-2 text-sm font-bold text-[#a3281f]">{err}</p>}
    </div>
  );
}

// Réservé au coach : il choisit pour qui il place les cours de la semaine (lui ou un entraîneur)
function CoachSchedules() {
  const { me } = useAuth();
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [who, setWho] = useState(me?.id ?? "");
  const [items, setItems] = useState<Course[]>([]);
  useEffect(() => { get<{ id: string; firstName: string | null }[]>("/trainers").then((l) => setPeople([{ id: me?.id ?? "", name: `${me?.firstName ?? "Moi"} (moi)` }, ...l.map((t) => ({ id: t.id, name: t.firstName ?? "Entraîneur" }))])).catch(() => {}); }, [me?.id, me?.firstName]);
  useEffect(() => { if (who) get<Course[]>(`/club/schedule/${who}`).then(setItems).catch(() => setItems([])); }, [who]);
  return (
    <section className="rounded border-2 border-line bg-white p-4">
      <h2 className="m-0 text-xl">🗓️ Placer les jours de cours</h2>
      <p className="m-0 mt-1 text-sm text-muted">Choisis la personne, puis place ses cours de la semaine (jour et horaires). Ils reviennent chaque semaine dans son planning.</p>
      <div className="mt-2 flex flex-wrap gap-2">{people.map((p) => <button key={p.id} type="button" aria-pressed={who === p.id} onClick={() => setWho(p.id)} className={"rounded-full border-2 px-3 py-1 text-sm font-bold " + (who === p.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}>{p.name}</button>)}</div>
      {who && <Schedule userId={who} items={items} readOnly={false} onSaved={setItems} />}
    </section>
  );
}

export default function MyClubEventsPage() {
  const { list, state, markSeen } = useMyClubEvents();
  const { me } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [privates, setPrivates] = useState<Lesson[]>([]); // mes cours particuliers (réservés ou confirmés)
  useEffect(() => { get<Lesson[]>("/lessons").then((all) => setPrivates(all.filter((l) => l.finalSlot && ["ACCEPTED", "BOOKED"].includes(l.status) && l.profId === me?.id))).catch(() => setPrivates([])); }, [me?.id, me?.role]);
  useEffect(() => { get<Course[]>("/club/my-schedule").then(setCourses).catch(() => {}); }, []);
  const fresh = (list ?? []).filter((e) => state(e) !== "vu");
  const today = todayIso();
  const days = Array.from({ length: 14 }, (_, i) => addDay(today, i));
  return (
    <>
      <PageHead eyebrow="Planning du club" title="Mon planning" icon="📅" />
      <Page>
        <p className="m-0 text-muted">Tes cours particuliers, tes cours habituels au club et les événements du club où le coach ou le président t'a placé (tournoi, stage, animation, match…). Seuls tes événements sont affichés ici.</p>
        {fresh.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded border-2 border-champagne bg-[#fff6dd] p-3"><span>🔔 <b>{fresh.length}</b> nouveau{fresh.length > 1 ? "x" : ""} ou modifié{fresh.length > 1 ? "s" : ""}.</span><button className="btn-ink" onClick={() => markSeen(list ?? [])}>J'ai tout vu</button></div>}
        <section>
          <h2 className="m-0 mb-3 text-xl">📆 Mes 14 prochains jours</h2>
          {list === null ? <p className="m-0 text-muted">Chargement…</p> : (
            <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
              {days.map((d) => {
                const cs = courses.filter((c) => c.weekday === wd(d)).sort((a, b) => a.start.localeCompare(b.start));
                const ps = privates.filter((l) => l.finalSlot!.date === d).sort((a, b) => a.finalSlot!.time.localeCompare(b.finalSlot!.time));
                const es = (list ?? []).filter((e) => e.startDate <= d && e.endDate >= d);
                return (
                  <li key={d} className={"rounded border-2 p-3 " + (cs.length || es.length || ps.length ? "border-line bg-white" : "border-dashed border-line bg-transparent text-muted")}>
                    <b className="capitalize">{fmtRange(d, d)}</b>{d === today && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs text-white">Aujourd'hui</span>}
                    {!cs.length && !es.length && !ps.length && <p className="m-0 text-sm">Rien de prévu</p>}
                    {cs.map((c) => <p key={c.start} className="m-0 mt-1 text-sm">🎾 <b>{c.start.replace(":", " h ")} – {c.end.replace(":", " h ")}</b> {c.label || "Cours"}</p>)}
                    {ps.map((l) => <p key={l.id} className="m-0 mt-1 text-sm">👤 <b>{l.finalSlot!.time.replace(":", " h ")}</b> Cours particulier · {adultName(l.member, "Adhérent")}{l.status === "BOOKED" ? " (à confirmer)" : ""}{l.place ? ` · ${l.place}` : ""}</p>)}
                    {es.map((e) => <p key={e.id} className="m-0 mt-1 text-sm" style={{ color: colorOf(e) }}>{kindOf(e.kind).icon} <b>{titleOf(e)}</b>{e.time ? ` · ${e.time}` : ""}{e.place ? ` · ${e.place}` : ""}{state(e) === "nouveau" ? " 🔔 nouveau" : state(e) === "modifie" ? " 🔔 modifié" : ""}</p>)}
                  </li>);
              })}
            </ul>
          )}
        </section>
        <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted"><span>👤 Cours particulier</span><span>🎾 Cours habituel du club</span><span>🏆 Événement où tu interviens</span></p>
        {me?.role === "COACH" ? <CoachSchedules /> : <section className="rounded border-2 border-line bg-white p-4"><h2 className="m-0 text-xl">🗓️ Mes jours de cours habituels</h2><p className="m-0 mt-1 text-sm text-muted">Placés par le coach. Ils reviennent chaque semaine dans ton planning ci-dessus.</p><Schedule userId={me?.id ?? ""} items={courses} readOnly onSaved={setCourses} /></section>}
        <section>
          <h2 className="m-0 mb-3 text-xl">🏆 Mes événements à venir</h2>
          {list === null ? null : list.length === 0 ? <p className="m-0 rounded border border-line bg-white p-4 text-muted">Tu n'es placé sur aucun événement à venir pour le moment. Quand le coach t'en ajoutera un, il apparaîtra ici et un message t'attendra sur ton accueil.</p> : (
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {list.map((e) => { const s = state(e); const k = kindOf(e.kind); return (
              <li key={e.id} className="rounded border-2 bg-white p-4" style={{ borderColor: colorOf(e) }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true">{k.icon}</span><b className="min-w-0 flex-1 [overflow-wrap:anywhere]">{titleOf(e)}</b>
                  {s === "nouveau" && <span className="rounded-full bg-champagne px-2 py-0.5 text-xs font-bold text-ink">Nouveau</span>}
                  {s === "modifie" && <span className="rounded-full bg-[#ffe08a] px-2 py-0.5 text-xs font-bold text-ink">Modifié</span>}
                </div>
                <p className="m-0 mt-1 font-bold capitalize">{fmtRange(e.startDate, e.endDate)}</p>
                {(e.time || e.place) && <p className="m-0 mt-1 text-sm text-muted">{e.time ? `🕒 ${e.time}` : ""}{e.time && e.place ? " · " : ""}{e.place ? `📍 ${e.place}` : ""}</p>}
                {e.note && <p className="m-0 mt-2 text-sm [overflow-wrap:anywhere]">📝 {e.note}</p>}
                {s !== "vu" && <button className="btn-outline mt-3 bg-white hover:bg-ink hover:text-white" onClick={() => markSeen([e])}>J'ai vu</button>}
              </li>); })}
          </ul>)}
        </section>
      </Page>
    </>
  );
}
