import { FormEvent, useCallback, useEffect, useState } from "react";
import { del, get, patch, post } from "../api";
import { AXES, currentSeason, Goal, goalApplies, Player, fullName, trimesterOf } from "../types";
import { Empty, Err } from "./ui";

export interface GoalTemplate { id: string; axis: string; title: string; indicator: string; targetStars: number; }

// Idées d'objectifs proposées au premier démarrage (le coach les garde, les change ou les supprime)
const STARTER: { axis: string; title: string; indicator: string }[] = [
  { axis: "TECHNIQUE", title: "Fiabiliser la première balle de service", indicator: "6 premières balles sur 10" },
  { axis: "TECHNIQUE", title: "Revers plus long", indicator: "8 balles sur 10 derrière la ligne de service" },
  { axis: "TECHNIQUE", title: "Coup droit plus profond", indicator: "" },
  { axis: "TECHNIQUE", title: "Volée plus assurée", indicator: "" },
  { axis: "TACTIQUE", title: "Varier les hauteurs et les effets", indicator: "Au moins 3 variations par match" },
  { axis: "TACTIQUE", title: "Jouer dans les zones libres du terrain", indicator: "" },
  { axis: "TACTIQUE", title: "Construire le point avant d'attaquer", indicator: "" },
  { axis: "PHYSIQUE", title: "Améliorer l'endurance", indicator: "" },
  { axis: "PHYSIQUE", title: "Être plus mobile : meilleur jeu de jambes", indicator: "" },
  { axis: "MENTAL", title: "Rester calme après une faute", indicator: "" },
  { axis: "MENTAL", title: "Routine entre les points", indicator: "Routine respectée 8 points sur 10" },
  { axis: "MENTAL", title: "Se concentrer sur son objectif", indicator: "" },
];

export function useGoalTemplates() {
  const [list, setList] = useState<GoalTemplate[] | null>(null);
  const load = useCallback(() => { get<GoalTemplate[]>("/goal-templates").then(setList).catch(() => setList([])); }, []);
  useEffect(load, [load]);
  return { list, load };
}

// Onglet « Définition des objectifs » : la bibliothèque d'objectifs du coach. Un objectif qu'on donne à un jeune devient SA mission du trimestre.
export function GoalLibraryTab({ players, isCoach, only, trimester, onGiven }: { players: Player[]; isCoach: boolean; only?: Player; trimester?: number; onGiven?: () => void }) {
  const { list, load } = useGoalTemplates();
  const [axis, setAxis] = useState("TECHNIQUE"), [title, setTitle] = useState(""), [indicator, setIndicator] = useState(""), [stars, setStars] = useState(10);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [giving, setGiving] = useState<string | null>(null); // objectif en cours d'attribution
  const [picked, setPicked] = useState<string[]>([]); const [triState, setTri] = useState(trimesterOf()); const tri = trimester ?? triState; const [result, setResult] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await post("/goal-templates", { axis, title: title.trim(), indicator: indicator.trim(), targetStars: stars }); setTitle(""); setIndicator(""); load(); } catch (x) { setErr((x as Error).message); }
  }
  async function seed() { setBusy(true); setErr(""); try { for (const s of STARTER) await post("/goal-templates", { ...s, targetStars: 10 }); load(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }
  async function upd(t: GoalTemplate, body: Partial<GoalTemplate>) { try { await patch(`/goal-templates/${t.id}`, { axis: t.axis, title: t.title, indicator: t.indicator, targetStars: t.targetStars, ...body }); load(); } catch (x) { setErr((x as Error).message); } }
  async function give(t: GoalTemplate) {
    setResult(""); setErr(""); setBusy(true);
    const season = currentSeason(); let done = 0, already = 0;
    try {
      for (const id of only ? [only.id] : picked) {
        const goals = await get<Goal[]>(`/players/${id}/goals?season=${season}`).catch(() => [] as Goal[]);
        if (goals.some((g) => g.title.trim().toLowerCase() === t.title.trim().toLowerCase() && goalApplies(g, tri))) { already++; continue; }
        await post(`/players/${id}/goals`, { season, axis: t.axis, title: t.title, indicator: t.indicator, trimesters: [tri], targetStars: t.targetStars });
        done++;
      }
      setResult(only ? (done ? `✅ Donné à ${only.firstName} pour le trimestre ${tri} : c'est maintenant sa mission.` : `${only.firstName} a déjà cet objectif au trimestre ${tri}.`) : `✅ Donné à ${done} jeune${done > 1 ? "s" : ""} pour le trimestre ${tri}${already ? ` (${already} l'avai${already > 1 ? "ent" : "t"} déjà)` : ""}. C'est maintenant leur mission.`);
      setPicked([]); if (done) onGiven?.();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4">
      <p className="alert m-0"><strong>Ta bibliothèque d'objectifs.</strong> Écris ici les objectifs que tu donnes souvent.{only ? <> En un clic, tu en donnes un à <strong>{only.firstName}</strong> pour le <strong>trimestre {tri}</strong> : il devient sa mission (on en voit la barre de progression dans « Progrès »).</> : <> En un clic, tu peux en donner un à un ou plusieurs jeunes : il devient <strong>leur mission</strong> du trimestre.</>}</p>
      {isCoach && (
        <form onSubmit={add} className="card grid gap-3 border-2 !border-clay" aria-labelledby="lib-add">
          <h3 id="lib-add" className="m-0">➕ Définir un nouvel objectif</h3>
          <div className="flex flex-wrap gap-2">
            <select className="input !w-auto" aria-label="Domaine" value={axis} onChange={(e) => setAxis(e.target.value)}>{AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
            <input className="input min-w-52 flex-1" aria-label="Objectif" maxLength={200} placeholder="Ex. : Fiabiliser la première balle de service" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input min-w-52 flex-1" aria-label="Comment le mesure-t-on ?" maxLength={200} placeholder="Comment le mesure-t-on ? (facultatif)" value={indicator} onChange={(e) => setIndicator(e.target.value)} />
            <label className="flex items-center gap-2 text-sm font-bold">⭐ étoiles pour réussir <input type="number" min={3} max={60} className="input !w-24" value={stars} onChange={(e) => setStars(Math.max(3, Math.min(60, Number(e.target.value) || 10)))} /></label>
            <button className="btn-clay" disabled={title.trim().length < 2}>+ Ajouter à la bibliothèque</button>
          </div>
        </form>
      )}
      <Err msg={err} />
      {result && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">{result}</p>}
      {list === null && <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />}
      {list && list.length === 0 && (
        <Empty>
          Ta bibliothèque est vide pour l'instant.{isCoach && <> <button className="btn-outline btn-sm ml-2" disabled={busy} onClick={seed}>Ajouter des idées de départ</button></>}
        </Empty>
      )}
      {list && list.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {AXES.map((a) => {
            const mine = list.filter((t) => t.axis === a.key);
            return (
              <section key={a.key} className="card grid content-start gap-3 border-t-[6px]" style={{ borderTopColor: a.color }} aria-label={a.label}>
                <h3 className="m-0" style={{ color: a.color }}>{a.label}</h3>
                {mine.length === 0 && <p className="hint m-0">Aucun objectif dans ce domaine.</p>}
                {mine.map((t) => (
                  <article key={t.id} className="grid gap-2 rounded-xl border border-line bg-chalk p-3">
                    {isCoach ? (
                      <>
                        <input className="input" aria-label="Objectif" defaultValue={t.title} maxLength={200} onBlur={(e) => e.target.value.trim().length >= 2 && e.target.value !== t.title && upd(t, { title: e.target.value.trim() })} />
                        <input className="input" aria-label="Comment le mesure-t-on ?" placeholder="Comment le mesure-t-on ?" defaultValue={t.indicator} maxLength={200} onBlur={(e) => e.target.value !== t.indicator && upd(t, { indicator: e.target.value })} />
                        <label className="flex flex-wrap items-center gap-2 text-sm font-bold">⭐ étoiles pour réussir <input type="number" min={3} max={60} className="input !w-24" defaultValue={t.targetStars} onBlur={(e) => { const v = Math.max(3, Math.min(60, Number(e.target.value) || 10)); if (v !== t.targetStars) upd(t, { targetStars: v }); }} /></label>
                      </>
                    ) : (
                      <><strong>{t.title}</strong>{t.indicator && <span className="text-sm text-muted">{t.indicator}</span>}<span className="text-sm font-bold">⭐ {t.targetStars} étoiles pour réussir</span></>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {only ? <button className="btn-clay btn-sm" disabled={busy} onClick={() => { setPicked([]); give(t); }}>🎁 Donner à {only.firstName} (T{tri})</button> : <button className="btn-clay btn-sm" aria-expanded={giving === t.id} onClick={() => { setGiving(giving === t.id ? null : t.id); setPicked([]); setResult(""); }}>🎁 Donner à des jeunes</button>}
                      {isCoach && <button className="btn-danger btn-sm" onClick={async () => { if (confirm("Retirer cet objectif de la bibliothèque ? (Les missions déjà données restent.)")) { await del(`/goal-templates/${t.id}`); load(); } }}>Supprimer</button>}
                    </div>
                    {!only && giving === t.id && (
                      <div className="grid gap-2 rounded-xl bg-sand p-3">
                        <p className="m-0 font-bold">À qui ? Pour quel trimestre ?</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Trimestre">
                          {[1, 2, 3].map((n) => <button key={n} type="button" aria-pressed={tri === n} onClick={() => setTri(n)} className={"btn btn-sm " + (tri === n ? "bg-ink text-white" : "border-2 border-line bg-white text-ink")}>Trimestre {n}</button>)}
                        </div>
                        {players.length === 0 ? <p className="hint m-0">Aucun jeune pour l'instant.</p> : (
                          <ul className="m-0 grid max-h-64 list-none gap-1 overflow-auto p-0 sm:grid-cols-2">
                            {players.map((p) => (
                              <li key={p.id}><label className="flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold has-[:checked]:bg-[#fdf1ea]"><input type="checkbox" className="accent-clay" checked={picked.includes(p.id)} onChange={(e) => setPicked((l) => (e.target.checked ? [...l, p.id] : l.filter((x) => x !== p.id)))} />{fullName(p)}</label></li>
                            ))}
                          </ul>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-outline btn-sm" onClick={() => setPicked(picked.length === players.length ? [] : players.map((p) => p.id))}>{picked.length === players.length ? "Tout décocher" : "Tout cocher"}</button>
                          <button type="button" className="btn-clay btn-sm" disabled={!picked.length || busy} onClick={() => give(t)}>Donner l'objectif ({picked.length})</button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
