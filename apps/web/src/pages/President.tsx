import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { ProfsAdmin } from "../components/Profs";
import { CoachHero, Empty, Page, TabsBar } from "../components/ui";
import { collapseSeries, Lesson, profName, todayIso } from "../types";
import { LessonRow } from "./Coach";
import { ProfsPlanning } from "../components/ProfsPlanning";

const TABS = ["activite", "demandes", "profs", "club"] as const;
type Tab = (typeof TABS)[number];
const byDate = (a: Lesson, b: Lesson) => (a.finalSlot!.date + a.finalSlot!.time).localeCompare(b.finalSlot!.date + b.finalSlot!.time);

// Espace du président : toute l'activité des professeurs, les demandes de cours des adultes, la validation des professeurs. (Le planning du club est dans son propre menu.)
export default function PresidentPage() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((k) => k === params.get("onglet")) ?? "activite") as Tab;
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { get<Lesson[]>("/lessons").then((l) => { setLessons(l); setErr(""); }).catch((e) => setErr((e as Error).message)); }, []);
  useEffect(load, [load]);

  const all = lessons ?? [];
  const today = todayIso();
  const toConfirm = collapseSeries(all.filter((l) => l.status === "BOOKED" && l.finalSlot)).sort(byDate);
  const upcoming = collapseSeries(all.filter((l) => l.status === "ACCEPTED" && l.finalSlot && l.finalSlot.date >= today)).sort(byDate);
  const old = all.filter((l) => l.status === "PENDING" || l.status === "PROPOSED");
  const done = all.filter((l) => l.status === "REFUSED" || (l.status === "ACCEPTED" && !upcoming.includes(l)));

  // Activité par professeur : cours confirmés à venir, à confirmer, annulés
  const groups = new Map<string, { name: string; confirmed: Lesson[]; waiting: Lesson[]; cancelled: number }>();
  const slot = (id: string, name: string) => { if (!groups.has(id)) groups.set(id, { name, confirmed: [], waiting: [], cancelled: 0 }); return groups.get(id)!; };
  for (const l of upcoming) slot(l.profId ?? "none", l.prof ? profName(l.prof) : "Sans professeur").confirmed.push(l);
  for (const l of toConfirm) slot(l.profId ?? "none", l.prof ? profName(l.prof) : "Sans professeur").waiting.push(l);
  for (const l of all.filter((x) => x.status === "REFUSED")) slot(l.profId ?? "none", l.prof ? profName(l.prof) : "Sans professeur").cancelled++;
  const list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <CoachHero eyebrow="Espace du président" title={`Bonjour ${me?.firstName ?? ""}`.trim()} subtitle="Toute l'activité des cours particuliers : ce que donne chaque professeur, les demandes des adhérents et la validation des professeurs. Le planning du club est dans le menu « Club »."  actions={<><Link to="/president/apercu" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">👀 Voir comme un adhérent</Link><Link to="/president/apercu-prof" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">👀 Voir comme un professeur</Link></>} />
      <Page>
        <Link to="/coach/club/partenaires" className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white p-3 no-underline hover:border-ink"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f3efe6] text-2xl" aria-hidden>🤝</span><span><b className="block text-ink">Partenaires du club</b><span className="text-sm text-muted">Suivi des sponsors, logos pour les affiches et dossier de présentation à leur envoyer.</span></span></Link>
        <TabsBar side={false} label="Cours particuliers" active={tab} onChange={(k) => setParams(k === "activite" ? {} : { onglet: k })}
          tabs={[["activite", "📊 Activité des professeurs", toConfirm.length], ["demandes", "📨 Demandes de cours", old.length], ["profs", "👩‍🏫 Professeurs"], ["club", "🗓️ Planning des profs"]]} />
        {err && <p role="alert" className="m-0 rounded-xl bg-[#fde8e8] p-3 font-bold text-[#8a1c1c]">{err}</p>}
        {lessons === null && !err && <p className="text-muted">Chargement…</p>}
        {lessons !== null && tab === "activite" && (
          <div className="grid gap-5">
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3" aria-label="Résumé par professeur">
              {list.map((g) => (
                <li key={g.name} className="card grid gap-1">
                  <strong className="text-lg">👩‍🏫 {g.name}</strong>
                  <span>✅ {g.confirmed.length} cours à venir</span>
                  <span>🔔 {g.waiting.length} à confirmer</span>
                  <span className="text-muted">❌ {g.cancelled} annulé{g.cancelled > 1 ? "s" : ""}</span>
                </li>))}
              {!list.length && <li><Empty>Aucun cours pour l'instant.</Empty></li>}
            </ul>
            {toConfirm.length > 0 && <section className="grid gap-2"><h2 className="m-0 text-lg">🔔 Réservés, le professeur doit confirmer ({toConfirm.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{toConfirm.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}</ul></section>}
            {upcoming.length > 0 && <section className="grid gap-2"><h2 className="m-0 text-lg">✅ Prochains cours confirmés ({upcoming.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{upcoming.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}</ul></section>}
          </div>
        )}
        {lessons !== null && tab === "demandes" && (
          <div className="grid gap-5">
            <section className="grid gap-2"><h2 className="m-0 text-lg">Anciennes demandes à clôturer ({old.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{old.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}{!old.length && <li><Empty>Aucune ancienne demande 🎾</Empty></li>}</ul></section>
            <section className="grid gap-2"><h2 className="m-0 text-lg">Demandes traitées ({done.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{done.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}{!done.length && <li><Empty>Rien pour l'instant.</Empty></li>}</ul></section>
          </div>
        )}
        {tab === "profs" && <ProfsAdmin onChanged={load} />}
        {tab === "club" && <ProfsPlanning />}
      </Page>
    </>
  );
}
