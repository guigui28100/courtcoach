import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get } from "../api";
import { PageHead, Page } from "../components/ui";
import { colorOf, evOn, kindOf, titleOf, ClubEvent } from "../clubPlan";
import { Lesson, Player, Goal, Evaluation, CourseStar, STATUS, EVAL_AXES, goalApplies, currentSeason, starsByDomain, fmtSlot, todayIso } from "../types";
import { put } from "../api";
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

// ───────── Comité · Ligue : binôme (référent du club + entraîneur de comité) par jeune, accès donnés par le coach SEUL ─────────
type Trainer = { id: string; email: string; firstName: string | null; kind?: "COMITE" | "CLUB"; playerIds: string[] };
function Comite() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const load = () => { get<Player[]>("/players").then(setPlayers).catch((e) => { setPlayers([]); setErr((e as Error).message); }); get<Trainer[]>("/trainers").then(setTrainers).catch((e) => setErr((e as Error).message)); };
  useEffect(load, []);
  const club = trainers.filter((t) => t.kind === "CLUB"); const comite = trainers.filter((t) => t.kind !== "CLUB");
  const rows = (players ?? []).map((p) => ({ p, c: club.filter((t) => t.playerIds.includes(p.id)), m: comite.filter((t) => t.playerIds.includes(p.id)) }));
  const full = rows.filter((r) => r.c.length && r.m.length).length;
  const noComite = rows.filter((r) => !r.m.length).length; const noClub = rows.filter((r) => !r.c.length).length;
  async function setAccess(t: Trainer, playerId: string, on: boolean) {
    setErr(""); setMsg("");
    const ids = on ? [...new Set([...t.playerIds, playerId])] : t.playerIds.filter((x) => x !== playerId);
    try { await put(`/trainers/${t.id}/players`, { playerIds: ids }); setMsg("Accès enregistré."); load(); } catch (e) { setErr((e as Error).message); }
  }
  const nm = (t: Trainer) => t.firstName || t.email;
  return (
    <section className="grid gap-5" aria-labelledby="cl-h">
      <h2 id="cl-h" className="m-0 font-display text-2xl">Comité · Ligue : les binômes</h2>
      <p className="m-0 max-w-3xl text-sm text-muted">Chaque jeune a un <b>binôme</b> : un entraîneur <b>du club</b> (référent) et un entraîneur <b>de comité</b>. Un entraîneur ne voit que les jeunes que <b>toi seul</b> lui confies ici. Les comptes d'entraîneurs se créent dans Jeunes · Centre › 👥 Entraîneurs.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[rows.length, "jeunes suivis"], [full, "binômes complets"], [noClub, "sans référent club"], [noComite, "sans entraîneur de comité"]].map(([n, l]) => <div key={String(l)} className="border border-line bg-paper p-3"><b className="block font-display text-3xl">{n}</b><span className="text-sm text-muted">{l}</span></div>)}
      </div>
      <p className="m-0 text-xs text-muted">Ces quatre chiffres ne contiennent aucun nom : ils peuvent être montrés tels quels à la ligue ou au comité.</p>
      {err && <p role="alert" className="m-0 text-sm text-[#b42318]">{err}</p>}{msg && <p role="status" className="m-0 text-sm text-[#1f7a45]">{msg}</p>}
      {players === null ? <div className="skeleton h-24" role="status" aria-label="Chargement" /> : rows.length === 0 ? <p className="m-0 text-sm text-muted">Aucun joueur pour l'instant.</p> : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {rows.map(({ p, c, m }) => (
            <li key={p.id} className="grid gap-2 border border-line bg-paper p-3">
              <div className="flex flex-wrap items-center gap-2"><b>{p.firstName} {p.lastName}</b>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.length && m.length ? "bg-[#e3f4e8] text-[#14532d]" : "bg-[#fff6dd] text-[#5c4300]"}`}>{c.length && m.length ? "✅ Binôme complet" : !c.length && !m.length ? "⚠ Aucun entraîneur" : !c.length ? "⚠ Manque le référent du club" : "⚠ Manque l'entraîneur de comité"}</span></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([["🏠 Référent du club", club, c], ["🏛️ Entraîneur de comité", comite, m]] as const).map(([label, all, cur]) => (
                  <div key={label} className="grid gap-1 text-sm"><span className="font-bold">{label}</span>
                    {all.length === 0 ? <span className="text-muted">Aucun compte de ce type : crée-le dans « Entraîneurs ».</span> : all.map((t) => (
                      <label key={t.id} className="flex items-center gap-2"><input type="checkbox" checked={cur.some((x) => x.id === t.id)} onChange={(e) => setAccess(t, p.id, e.target.checked)} /> {nm(t)}</label>))}
                  </div>))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-sm text-muted">Règle d'or : seul le coach donne ou retire un accès. Chaque entraîneur voit uniquement ses jeunes cochés ; bilans et bulletins se saisissent déjà par le coach et les entraîneurs concernés, et tu les valides toi-même.</p>
    </section>
  );
}

// ───────── Carnet de saison : la saison d'un joueur sur une page, à imprimer ou enregistrer en PDF ─────────
function Carnet() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [id, setId] = useState(""); const [season, setSeason] = useState(currentSeason());
  const [data, setData] = useState<{ goals: Goal[]; evals: Evaluation[]; stars: CourseStar[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { get<Player[]>("/players").then(setPlayers).catch((e) => setErr((e as Error).message)); }, []);
  useEffect(() => {
    setData(null); if (!id) return;
    Promise.all([get<Goal[]>(`/players/${id}/goals`), get<Evaluation[]>(`/players/${id}/evaluations`), get<CourseStar[]>(`/players/${id}/stars`)]).then(([goals, evals, stars]) => setData({ goals, evals, stars })).catch((e) => setErr((e as Error).message));
  }, [id]);
  const p = players.find((x) => x.id === id);
  const seasons = [currentSeason(new Date(Date.now() - 365 * 864e5)), currentSeason()];
  return (
    <section className="grid gap-4" aria-labelledby="cn-h">
      <div className="grid gap-3 print:hidden">
        <h2 id="cn-h" className="m-0 font-display text-2xl">Carnet de saison</h2>
        <p className="m-0 max-w-3xl text-sm text-muted">Choisis un joueur : tu obtiens toute sa saison sur une page (départ, missions de chaque trimestre, étoiles). Ensuite « Imprimer » → « Enregistrer en PDF ».</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-bold">Joueur<select value={id} onChange={(e) => setId(e.target.value)}><option value="">Choisir…</option>{players.map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-bold">Saison<select value={season} onChange={(e) => setSeason(e.target.value)}>{seasons.map((x) => <option key={x}>{x}</option>)}</select></label>
          <button type="button" className="btn-clay" disabled={!data} onClick={() => window.print()}>🖨️ Imprimer / PDF</button>
        </div>
        {err && <p role="alert" className="m-0 text-sm text-[#b42318]">{err}</p>}
      </div>
      {p && data && (() => {
        const ev = data.evals.filter((e) => e.season === season);
        const start = ev.find((e) => e.trimester === 0);
        return (
          <article className="grid gap-5 border border-line bg-white p-6 text-ink print:border-0 print:p-0">
            <header className="border-b-2 border-ink pb-3"><p className="m-0 text-xs uppercase tracking-widest text-muted">Tennis Club Houdan · Carnet de saison {season}</p><h1 className="m-0 font-display text-4xl">{p.firstName} {p.lastName}</h1>
              <p className="m-0 text-sm text-muted">{[p.ranking && `Classement ${p.ranking}`, p.targetRanking && `Objectif ${p.targetRanking}`].filter(Boolean).join(" · ") || "Classement non renseigné"}</p></header>
            <section><h2 className="m-0 mb-1 font-display text-xl">📍 Point de départ</h2>
              {start ? <div className="grid gap-1 text-sm">{start.strengths && <p className="m-0"><b>Points forts :</b> {start.strengths}</p>}{start.improve && <p className="m-0"><b>À progresser :</b> {start.improve}</p>}{start.appreciation && <p className="m-0"><b>Mot du coach :</b> {start.appreciation}</p>}{!start.strengths && !start.improve && !start.appreciation && <p className="m-0 text-muted">Bilan rempli, sans texte.</p>}</div> : <p className="m-0 text-sm text-muted">Pas de bilan de départ pour cette saison.</p>}</section>
            {[1, 2, 3].map((t) => {
              const goals = data.goals.filter((g) => g.season === season && goalApplies(g, t));
              const e = ev.find((x) => x.trimester === t); const st = starsByDomain(data.stars, season, t);
              return (
                <section key={t} className="break-inside-avoid"><h2 className="m-0 mb-1 font-display text-xl">Trimestre {t}</h2>
                  {goals.length === 0 ? <p className="m-0 text-sm text-muted">Aucune mission.</p> : <ul className="m-0 grid list-none gap-1 p-0 text-sm">{goals.map((g) => { const cp = g.checkpoints.find((c) => c.trimester === t); const s = cp ? STATUS[cp.status] : null; return <li key={g.id} className="flex flex-wrap gap-2"><span>•</span><span className="min-w-0 flex-1">{g.title}{cp?.comment ? <i className="text-muted"> — {cp.comment}</i> : null}</span>{s && <span className="font-bold">{s.emoji} {s.label}</span>}</li>; })}</ul>}
                  <p className="m-0 mt-1 text-sm"><b>Étoiles :</b> {EVAL_AXES.map((a) => `${a.label} ${st[a.key]}`).join(" · ")}</p>
                  {e?.appreciation && <p className="m-0 mt-1 text-sm"><b>Mot du coach :</b> {e.appreciation}</p>}
                </section>);
            })}
            <footer className="mt-4 grid grid-cols-2 gap-8 border-t pt-3 text-xs text-muted"><span>Signature du coach</span><span>Signature des parents</span></footer>
          </article>
        );
      })()}
    </section>
  );
}
