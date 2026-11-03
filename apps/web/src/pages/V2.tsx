import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get } from "../api";
import { PageHead, Page } from "../components/ui";
import { colorOf, evOn, kindOf, titleOf, ClubEvent } from "../clubPlan";
import { Lesson, fmtSlot, todayIso } from "../types";
import Cockpit from "./Cockpit";

// V2 (réservée au coach, essai) : un seul endroit pour les nouveautés. Rien n'est envoyé sur Internet ; aucune donnée d'élève.
const TABS: [string, string][] = [["cockpit", "📊 Cockpit"], ["planning", "🗓️ Planning à calques"], ["seance", "⏱️ Séance guidée"], ["comite", "🏛️ Comité · Ligue"], ["carnet", "📘 Carnet de saison"]];
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default function V2() {
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some(([k]) => k === sp.get("onglet")) ? sp.get("onglet")! : "cockpit";
  return (
    <>
      <PageHead eyebrow="Réservé au coach · essai" title="CourtCoach V2" />
      <Page>
        <div role="tablist" aria-label="Rubriques de la V2" className="flex flex-wrap gap-2">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setSp({ onglet: k })} className={tab === k ? "btn-ink" : "btn-outline"}>{l}</button>)}
        </div>
        {tab === "cockpit" && <Cockpit embedded />}
        {tab === "planning" && <Layers />}
        {tab === "seance" && <Guided />}
        {tab === "comite" && <Comite />}
        {tab === "carnet" && <Carnet />}
      </Page>
    </>
  );
}

// ───────── Planning à calques : le club et les cours particuliers dans une seule vue, calques à cocher ─────────
function Layers() {
  const today = todayIso();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [showClub, setShowClub] = useState(true); const [showLessons, setShowLessons] = useState(true);
  const [days, setDays] = useState(14);
  useEffect(() => { get<{ events: ClubEvent[] }>("/club/plan").then((d) => setEvents(d.events)).catch(() => {}); get<Lesson[]>("/lessons").then(setLessons).catch(() => {}); }, []);
  const list = useMemo(() => Array.from({ length: days }, (_, i) => addDays(today, i)).map((day) => ({
    day,
    ev: showClub ? events.filter((e) => evOn(e, day)) : [],
    ls: showLessons ? lessons.filter((l) => (l.status === "ACCEPTED" || l.status === "BOOKED") && l.finalSlot?.date === day).sort((a, b) => a.finalSlot!.time.localeCompare(b.finalSlot!.time)) : [],
  })), [days, today, events, lessons, showClub, showLessons]);
  return (
    <section className="grid gap-4" aria-labelledby="ly-h">
      <h2 id="ly-h" className="m-0 font-display text-2xl">Tout le planning, sur une seule page</h2>
      <p className="m-0 max-w-3xl text-sm text-muted">Coche les calques que tu veux voir. Les jours où il se passe plusieurs choses sont marqués « ⚠ à vérifier » pour que rien ne se chevauche sans que tu le saches.</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showClub} onChange={(e) => setShowClub(e.target.checked)} /> 🏆 Événements du club</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showLessons} onChange={(e) => setShowLessons(e.target.checked)} /> 📅 Cours particuliers</label>
        <label className="ml-auto flex items-center gap-2">Période <select value={days} onChange={(e) => setDays(+e.target.value)}><option value={7}>7 jours</option><option value={14}>14 jours</option><option value={30}>30 jours</option></select></label>
      </div>
      <ol className="m-0 grid list-none gap-2 p-0">
        {list.map(({ day, ev, ls }) => {
          const busy = ev.length + ls.length > 1 && ev.length > 0 && ls.length > 0;
          return (
            <li key={day} className={`grid gap-1 border bg-paper p-3 sm:grid-cols-[150px_minmax(0,1fr)] ${busy ? "border-[#c88a00]" : "border-line"}`}>
              <div className="text-sm font-bold capitalize">{day === today ? "Aujourd'hui" : longDay(day)}{busy && <span className="ml-2 rounded-full bg-[#fff6dd] px-2 py-0.5 text-xs text-[#5c4300]">⚠ à vérifier</span>}</div>
              <div className="grid gap-1 text-sm">
                {ev.length + ls.length === 0 && <span className="text-muted">—</span>}
                {ev.map((e) => <div key={e.id} className="flex items-center gap-2" style={e.tentative ? { opacity: 0.7 } : undefined}><span aria-hidden className="size-3 rounded-full" style={{ background: colorOf(e) }} /><b>{kindOf(e.kind).icon} {titleOf(e)}</b>{e.tentative && <span className="text-xs text-muted">prévisionnel</span>}</div>)}
                {ls.map((l) => <div key={l.id} className="flex items-center gap-2"><span aria-hidden>📅</span><b className="capitalize">{fmtSlot(l.finalSlot!)}</b>{l.status === "BOOKED" && <span className="text-xs text-muted">(à confirmer)</span>}</div>)}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="m-0 text-sm text-muted">Pas encore dans cette vue : les cours du club des entraîneurs et les compétitions des jeunes (ils restent dans « Planning des profs » et dans le Centre).</p>
      <Link to="/coach/club" className="text-sm font-bold underline">Ouvrir le planning du club pour modifier →</Link>
    </section>
  );
}

// ───────── Séance guidée : un minuteur par étapes, sur téléphone. Aucun nom d'enfant, rien n'est envoyé ─────────
type Step = { name: string; min: number };
const DEFAULT_STEPS: Step[] = [{ name: "Échauffement", min: 10 }, { name: "Exercice 1", min: 15 }, { name: "Exercice 2", min: 15 }, { name: "Jeu", min: 15 }, { name: "Retour au calme", min: 5 }];
function Guided() {
  const [steps, setSteps] = useState<Step[]>(() => { try { const v = JSON.parse(localStorage.getItem("cc-seance") || "null"); if (Array.isArray(v) && v.length) return v; } catch { /* rien */ } return DEFAULT_STEPS; });
  const [run, setRun] = useState<{ i: number; left: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => { try { localStorage.setItem("cc-seance", JSON.stringify(steps)); } catch { /* rien */ } }, [steps]);
  useEffect(() => {
    if (!run || paused) return;
    const t = setInterval(() => setRun((r) => { if (!r) return r; if (r.left > 1) return { ...r, left: r.left - 1 }; const n = r.i + 1; return n < steps.length ? { i: n, left: steps[n].min * 60 } : null; }), 1000);
    return () => clearInterval(t);
  }, [run, paused, steps]);
  async function start() { setPaused(false); setRun({ i: 0, left: steps[0].min * 60 }); try { lock.current = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* pas grave */ } }
  function stop() { setRun(null); lock.current?.release().catch(() => {}); lock.current = null; }
  const total = steps.reduce((a, s) => a + s.min, 0);
  if (run) {
    const mm = String(Math.floor(run.left / 60)).padStart(2, "0"); const ss = String(run.left % 60).padStart(2, "0");
    return (
      <section className="grid gap-4 bg-ink p-6 text-center text-white" aria-live="polite">
        <p className="m-0 text-sm uppercase tracking-widest text-champagne">Étape {run.i + 1} sur {steps.length}</p>
        <h2 className="m-0 font-display text-4xl text-white">{steps[run.i].name}</h2>
        <div className="font-display text-[22vw] leading-none sm:text-[9rem]" aria-label={`${mm} minutes ${ss} secondes`}>{mm}:{ss}</div>
        <p className="m-0 text-sm text-[#d6cdbb]">{run.i + 1 < steps.length ? `Ensuite : ${steps[run.i + 1].name}` : "Dernière étape"}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-outline !bg-white" onClick={() => setPaused((p) => !p)}>{paused ? "▶ Reprendre" : "⏸ Pause"}</button>
          <button type="button" className="btn-outline !bg-white" onClick={() => setRun(run.i + 1 < steps.length ? { i: run.i + 1, left: steps[run.i + 1].min * 60 } : null)}>⏭ Étape suivante</button>
          <button type="button" className="btn-outline !bg-white" onClick={stop}>■ Arrêter</button>
        </div>
      </section>
    );
  }
  return (
    <section className="grid max-w-2xl gap-4" aria-labelledby="sg-h">
      <h2 id="sg-h" className="m-0 font-display text-2xl">Séance guidée</h2>
      <p className="m-0 text-sm text-muted">Écris les étapes de ta séance et leur durée. Sur le terrain, l'écran affiche un grand minuteur et l'étape suivante (l'écran reste allumé quand le téléphone le permet). Ta séance est gardée seulement sur cet appareil ; aucun nom d'élève.</p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {steps.map((st, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_84px_auto] items-center gap-2">
            <input aria-label={`Nom de l'étape ${i + 1}`} value={st.name} maxLength={60} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <input aria-label={`Minutes de l'étape ${i + 1}`} type="number" min={1} max={120} value={st.min} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, min: Math.max(1, Math.min(120, +e.target.value || 1)) } : x))} />
            <button type="button" className="btn-outline !px-3" aria-label={`Retirer l'étape ${i + 1}`} onClick={() => setSteps(steps.filter((_, j) => j !== i))} disabled={steps.length < 2}>✕</button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline" onClick={() => steps.length < 12 && setSteps([...steps, { name: "Nouvelle étape", min: 10 }])}>＋ Ajouter une étape</button>
        <button type="button" className="btn-outline" onClick={() => setSteps(DEFAULT_STEPS)}>Remettre le modèle</button>
        <span className="text-sm text-muted">Total : {total} min</span>
        <button type="button" className="btn-clay ml-auto" onClick={start}>▶ Démarrer la séance</button>
      </div>
    </section>
  );
}

// ───────── Comité · Ligue : pas encore actif (touche aux données de mineurs, décision à prendre ensemble) ─────────
function Comite() {
  return (
    <section className="grid max-w-3xl gap-3" aria-labelledby="cl-h">
      <h2 id="cl-h" className="m-0 font-display text-2xl">Comité · Ligue</h2>
      <p className="m-0 border-l-4 border-[#c88a00] bg-[#fff6dd] p-3 text-sm text-[#5c4300]">🚧 Pas encore actif. Cette partie fait voir des jeunes à des personnes extérieures au club : je ne la branche pas sans ton accord écrit sur les règles ci-dessous.</p>
      <ul className="m-0 grid gap-2 pl-5 text-sm">
        <li><b>Binôme :</b> un référent du club + un entraîneur de comité par jeune.</li>
        <li><b>Cloisonnement :</b> le comité ne voit QUE les jeunes que tu lui confies, un par un.</li>
        <li><b>Validation :</b> bilans et bulletins validés par le binôme, jamais par le comité seul ; toi seul donnes les accès.</li>
        <li><b>Tableau de bord :</b> chiffres anonymes seulement (pas de nom).</li>
        <li><b>Familles :</b> un passage de relais d'un club à un autre demande l'accord des parents.</li>
      </ul>
      <p className="m-0 text-sm text-muted">Dis-moi « OK comité » avec les changements que tu veux, et je le construis avec la base de données et les tests de sécurité.</p>
    </section>
  );
}

// ───────── Carnet de saison : pointe vers ce qui existe déjà ─────────
function Carnet() {
  return (
    <section className="grid max-w-3xl gap-3" aria-labelledby="cn-h">
      <h2 id="cn-h" className="m-0 font-display text-2xl">Carnet de saison</h2>
      <p className="m-0 border-l-4 border-[#c88a00] bg-[#fff6dd] p-3 text-sm text-[#5c4300]">🚧 Pas encore fait : le carnet qui réunit toute la saison d'un joueur en un seul PDF.</p>
      <p className="m-0 text-sm text-muted">En attendant, chaque trimestre a déjà son bulletin imprimable (fiche du joueur › Bulletins).</p>
      <Link to="/coach/centre?onglet=bulletins" className="text-sm font-bold underline">Ouvrir les bulletins →</Link>
    </section>
  );
}
