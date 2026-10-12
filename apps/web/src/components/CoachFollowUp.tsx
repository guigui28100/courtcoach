import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, post, put } from "../api";
import { CoachDeclaredMatches } from "./DeclaredMatches";
import { GoalEvalCard } from "./GoalEval";
import { CoachSelfEval } from "./SelfEval";
import { Radar } from "./Radar";
import { hasContent } from "./BulletinShelf";
import { useStars } from "./Stars";
import { MatchTable, useFollowUp } from "./Suivi";
import { AuthorBadge, Err, Field } from "./ui";
import { RANKINGS, AXES, axisAverage, LEVELS, levelOf, DOMAIN_EMOJI, currentSeason, Goal, goalApplies, Evaluation, EVAL_AXES, fmtAvg, inPeriod, MatchRow, periodLabel, periodShort, previousPeriod, Player, RATING_LABELS, START_ITEMS, itemKey, ratedCount, trimesterOf, TOTAL_SKILLS, trendCommon, overallAverage, fmtDate } from "../types";

const seasonsAround = () => { const y = Number(currentSeason().slice(0, 4)); return [`${y - 1}-${y}`, `${y}-${y + 1}`, `${y + 1}-${y + 2}`]; };

function PeriodPicker({ season, t, onChange }: { season: string; t: number; onChange: (s: string, t: number) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="field"><label htmlFor="pp-season" className="sr-only">Saison</label><select id="pp-season" className="input !w-auto" value={season} onChange={(e) => onChange(e.target.value, t)}>{seasonsAround().map((s) => <option key={s} value={s}>Saison {s.replace("-", "/")}</option>)}</select></div>
      <div className="field"><label htmlFor="pp-t" className="sr-only">Trimestre</label><select id="pp-t" className="input !w-auto" value={t} onChange={(e) => onChange(season, Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? "Bilan de début d'année" : `Trimestre ${n}`}</option>)}</select></div>
    </div>
  );
}

export function Evaluations({ p, onSaved, onGoto }: { p: Player; onSaved?: () => void; onGoto?: (tab: "objectifs") => void }) {
  const [season, setSeason] = useState(currentSeason());
  const [t, setT] = useState(trimesterOf());
  const [version, setVersion] = useState(0);
  const { evals } = useFollowUp(p.id, version);
  const saved = evals?.find((e) => e.season === season && e.trimester === t);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [made, setMade] = useState<Record<string, boolean>>({});
  useEffect(() => { get<Goal[]>(`/players/${p.id}/goals?season=${season}`).then(setGoals).catch(() => setGoals([])); }, [p.id, season]);
  const here = t === 0 ? [] : goals.filter((g) => goalApplies(g, t));
  // On recharge le formulaire quand on change de trimestre ou quand les données arrivent.
  useEffect(() => { setRatings(saved?.ratings ?? {}); setComments(saved?.comments ?? {}); setMsg(null); }, [saved?.id, season, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevP = previousPeriod(season, t);
  const prev = evals?.find((e) => e.season === prevP.season && e.trimester === prevP.t);
  const count = Object.values(ratings).filter(Boolean).length;
  const series = useMemo(() => {
    const now: Record<string, number> = {}, before: Record<string, number> = {};
    EVAL_AXES.forEach((a) => { now[a.key] = axisAverage({ ratings }, a); before[a.key] = axisAverage(prev, a); });
    return [{ label: periodShort(season, t), values: now, color: "#b8471f" }, ...(prev ? [{ label: periodShort(prevP.season, prevP.t), values: before, color: "#10203a", dashed: true }] : [])];
  }, [ratings, prev, season, t, prevP.t, prevP.season]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const txt = (k: string) => String(f.get(k) ?? "");
    try {
      await put(`/players/${p.id}/evaluations/${season}/${t}`, { ratings, comments: Object.fromEntries(Object.entries(comments).filter(([, v]) => v.trim())), strengths: txt("strengths"), improve: txt("improve"), next: txt("next"), appreciation: txt("appreciation") });
      setMsg({ ok: true, text: "Évaluation enregistrée ✓" }); setVersion((v) => v + 1); onSaved?.();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }

  const axisOf = (g: Goal) => AXES.find((x) => x.key === g.axis);
  const stars = useStars(p.id);
  const startDone = hasContent(evals?.find((e) => e.season === currentSeason() && e.trimester === 0));
  return (
    <div className="grid gap-4">
      {evals && season === currentSeason() && (
        <section className={"card flex flex-wrap items-center justify-between gap-3 border-2 " + (startDone ? "border-line" : "!border-clay")} aria-label="Bilan de départ">
          <div className="grid gap-1">
            <h3 className="m-0">📍 Bilan de départ de {p.firstName} (début de saison)</h3>
            <p className="m-0 text-sm text-muted">{startDone ? "Déjà rempli : le jeune le voit en haut de son onglet Missions." : "Pas encore rempli. C’est le point de départ de la saison : tu notes ses 5 domaines, il le verra dans son onglet Missions."}</p>
          </div>
          <button type="button" className={t === 0 ? "btn-ink btn-sm" : "btn-clay"} disabled={t === 0} onClick={() => { setSeason(currentSeason()); setT(0); }}>{t === 0 ? "Tu es sur le bilan de départ ↓" : startDone ? "Modifier le bilan de départ" : "Saisir le bilan de départ"}</button>
        </section>
      )}
      {t > 0 && <CoachSelfEval p={p} season={season} t={t} goals={here} onPick={(s, n) => { setSeason(s); setT(n); }} />}
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker season={season} t={t} onChange={(s, n) => { setSeason(s); setT(n); }} />
        {saved && <AuthorBadge a={saved} prefix="Dernière saisie :" />}
        {saved && <Link to={`/coach/centre/${p.id}/bulletin/${season}/${t}`} className="btn-outline btn-sm no-underline">{t === 0 ? "Voir le bilan" : "Voir le bulletin"}</Link>}
      </div>

      {t > 0 && (
        <section className="card grid gap-3" aria-labelledby="ev-objectifs">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="ev-objectifs" className="m-0 text-xl">🎯 Missions fixées pour le trimestre {t}</h2><p className="hint m-0">Ce sont les missions que tu as fixées dans l'onglet Objectifs. Pour chacune, indique où elle en est : statut, avancement et ton commentaire. C'est enregistré tout de suite et <strong>figure automatiquement sur le bulletin du trimestre {t}</strong>.</p></div>
            <Link to={`/coach/centre/${p.id}/bulletin/${season}/${t}`} className="btn-outline btn-sm no-underline">Voir le bulletin du trimestre {t}</Link></div>
          {here.length === 0 ? <p className="alert m-0">Aucun objectif n'est prévu au trimestre {t}. Fixe-les dans l'onglet <strong>Objectifs</strong>.</p> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {here.map((g) => <GoalEvalCard key={`${g.id}-${t}`} g={g} t={t} season={season} stars={stars ?? []} color={axisOf(g)?.color ?? "#7c3aed"} label={axisOf(g)?.label ?? ""} onUpdate={(n) => { setGoals((l) => l.map((x) => (x.id === n.id ? n : x))); setVersion((v) => v + 1); }} />)}
            </div>
          )}
        </section>
      )}

      <StartBilan key={`${season}-${t}-${evals ? "ok" : "chargement"}`} p={p} season={season} t={t} saved={saved} onSaved={() => { setVersion((v) => v + 1); onSaved?.(); }} onGoto={onGoto} />
    </div>
  );
}

// Bilan de départ, version simple : une note par domaine, deux phrases et un mot du coach (les missions se donnent dans « Définition des objectifs »)
export function StartBilan({ p, season, t, saved, onSaved, onGoto }: { p: Player; season: string; t: number; saved?: Evaluation; onSaved: () => void; onGoto?: (tab: "objectifs") => void }) {
  const [rt, setRt] = useState<Record<string, number>>(() => ({ ...Object.fromEntries(EVAL_AXES.map((a) => [a.key, Math.round(axisAverage(saved, a))]).filter(([, v]) => v)), ...Object.fromEntries(Object.entries(saved?.ratings ?? {}).filter(([k]) => k.startsWith("d_"))) }));
  // Toucher un niveau : la note du domaine devient la moyenne des points notés (arrondie à un entier de 1 à 5, comme avant)
  const setItem = (axis: string, key: string, n: number) => setRt((r) => { const next = { ...r, [key]: n }; const vals = (START_ITEMS[axis] ?? []).map(([k]) => next[itemKey(axis, k)]).filter(Boolean); if (vals.length) next[axis] = Math.min(5, Math.max(1, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length))); return next; });
  const [word, setWord] = useState(saved?.appreciation ?? "");
  // Points forts et priorités : calculés d'après les niveaux (le coach n'écrit rien)
  const listOf = (levels: number[]) => EVAL_AXES.flatMap((a) => (START_ITEMS[a.key] ?? []).filter(([k]) => levels.includes(levelOf(rt[itemKey(a.key, k)]))).map(([, label]) => label));
  const strong = listOf([3]).length ? listOf([3]) : listOf([2]), todo = listOf([0]).length ? listOf([0]) : listOf([1]);
  const counts = LEVELS.map((_, i) => EVAL_AXES.reduce((n, a) => n + (START_ITEMS[a.key] ?? []).filter(([k]) => levelOf(rt[itemKey(a.key, k)]) === i).length, 0));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await put(`/players/${p.id}/evaluations/${season}/${t}`, { ratings: { ...(saved?.ratings ?? {}), ...rt }, comments: saved?.comments ?? {}, strengths: t === 0 ? (strong.length ? strong.slice(0, 6).join(" ; ") : saved?.strengths ?? "") : saved?.strengths ?? "", improve: t === 0 ? (todo.length ? todo.slice(0, 6).join(" ; ") : saved?.improve ?? "") : saved?.improve ?? "", next: saved?.next ?? "", appreciation: word });
      setMsg({ ok: true, text: "Enregistré ✓" }); onSaved();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  return (
    <form onSubmit={save} className="grid gap-4" noValidate>
      <p className="alert m-0">{t === 0 ? <><strong>Bilan de départ.</strong> Pour chaque point, touche le niveau actuel. C'est tout : le radar, les points forts et les priorités se calculent tout seuls. Les missions se donnent dans l'onglet « Définir les objectifs de travail ».</> : <><strong>Image du joueur à la fin du trimestre {t}.</strong> Pour chaque point, touche le niveau actuel : cela fait le radar du bulletin. Les missions se notent plus haut (atteinte, en cours, non atteinte).</>}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Résumé">
        {LEVELS.map((l, i) => <div key={l.label} className="rounded-2xl border-t-[5px] bg-white p-3 text-center shadow-sm" style={{ borderTopColor: l.color }}><b className="block text-3xl" style={{ color: l.color }}>{counts[i]}</b><span className="text-sm font-bold">{l.label}</span></div>)}
      </div>
      {EVAL_AXES.map((a) => {
        const items = START_ITEMS[a.key] ?? [];
        const done = items.filter(([k]) => levelOf(rt[itemKey(a.key, k)]) >= 2).length;
        const oldNote = !items.some(([k]) => rt[itemKey(a.key, k)]) && rt[a.key];
        return (
          <fieldset key={a.key} className="card grid gap-1 border-l-[8px]" style={{ borderLeftColor: a.color }}>
            <legend className="sr-only">{a.label}</legend>
            <h3 className="m-0 flex items-center gap-2 text-xl" style={{ color: a.color }}><span aria-hidden="true">{DOMAIN_EMOJI[a.key]}</span>{a.label}<small className="ml-auto rounded-full bg-sand px-3 py-1 text-sm font-bold text-muted">{done} sur {items.length} acquis</small></h3>
            {oldNote ? <p className="hint m-0">Ancienne note du domaine : {rt[a.key]}/5 (remplacée dès que tu notes un point ci-dessous).</p> : null}
            {items.map(([k, label]) => {
              const cur = levelOf(rt[itemKey(a.key, k)]);
              return (
                <div key={k} role="radiogroup" aria-label={label} className="grid gap-2 border-t border-line py-2 sm:grid-cols-[170px_1fr] sm:items-center">
                  <span className="font-bold">{label}</span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {LEVELS.map((l, i) => (
                      <button key={l.label} type="button" role="radio" aria-checked={cur === i} onClick={() => setItem(a.key, itemKey(a.key, k), l.rating)}
                        className={"min-h-11 rounded-xl border-2 px-1.5 text-center text-[13px] leading-tight " + (cur === i ? "font-black text-white shadow-md" : "border-line bg-sand font-bold text-muted hover:bg-white")}
                        style={cur === i ? { background: l.color, borderColor: l.color } : undefined}>{l.label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>
        );
      })}
      {t === 0 && (strong.length > 0 || todo.length > 0) && <div className="grid gap-2 rounded-2xl border border-line bg-white p-3 text-sm sm:grid-cols-2"><p className="m-0"><strong>⭐ Points forts (automatique) :</strong> {strong.join(", ") || "—"}</p><p className="m-0"><strong>🎯 À travailler en priorité (automatique) :</strong> {todo.join(", ") || "—"}</p></div>}
      <fieldset className="card grid gap-3"><legend className="px-2 font-display text-lg font-bold">💬 Le mot du coach</legend>
        <Field label="Un commentaire pour le bulletin (facultatif)" id="b-word"><textarea id="b-word" className="input" maxLength={3000} value={word} onChange={(e) => setWord(e.target.value)} placeholder="Ex. : Un joueur plein d'envie, continue comme ça !" /></Field>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3"><button className="btn-clay">{t === 0 ? "Enregistrer le bilan" : "Enregistrer l'image du joueur"}</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
    </form>
  );
}

export function Matchs({ p }: { p: Player }) {
  const [version, setVersion] = useState(0);
  const { matches } = useFollowUp(p.id, version);
  const [err, setErr] = useState("");
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErr("");
    try { await post(`/players/${p.id}/matches`, { date: String(f.get("date")), tournament: String(f.get("tournament")), round: String(f.get("round") || ""), result: f.get("result"), opponentRanking: String(f.get("opponentRanking") || "") || undefined, score: String(f.get("score") || ""), remark: String(f.get("remark") || "") }); form.reset(); setVersion((v) => v + 1); } catch (x) { setErr((x as Error).message); }
  }
  const wins = matches.filter((m) => m.result === "Victoire").length;
  return (
    <div className="grid gap-4">
      <form onSubmit={add} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3" noValidate>
        <h3 className="m-0 sm:col-span-2 lg:col-span-3">Ajouter un match</h3>
        <Field label="Date" id="m-date"><input id="m-date" name="date" type="date" required className="input" /></Field>
        <Field label="Tournoi ou rencontre" id="m-t"><input id="m-t" name="tournament" required maxLength={120} className="input" /></Field>
        <Field label="Tour (facultatif)" id="m-r"><input id="m-r" name="round" maxLength={60} className="input" placeholder="1/4 de finale" /></Field>
        <Field label="Résultat" id="m-res"><select id="m-res" name="result" className="input"><option>Victoire</option><option>Défaite</option></select></Field>
        <Field label="Classement de l'adversaire (facultatif)" id="m-rk"><select id="m-rk" name="opponentRanking" className="input" defaultValue=""><option value="">Non renseigné</option>{RANKINGS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
        <Field label="Score" id="m-s"><input id="m-s" name="score" maxLength={40} className="input" placeholder="6/3 4/6 6/2" /></Field>
        <Field label="Remarque (facultatif)" id="m-rem"><input id="m-rem" name="remark" maxLength={300} className="input" /></Field>
        <div className="sm:col-span-2 lg:col-span-3"><button className="btn-clay">Ajouter</button></div>
      </form>
      <Err msg={err} />
      <CoachDeclaredMatches p={p} />
      {matches.length > 0 && <p className="m-0 font-bold">{wins} victoire{wins > 1 ? "s" : ""} · {matches.length - wins} défaite{matches.length - wins > 1 ? "s" : ""}</p>}
      <div className="card"><MatchTable matches={matches} />{!matches.length && <p className="m-0 text-muted">Aucun match enregistré.</p>}</div>
      {matches.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{matches.map((m: MatchRow) => <li key={m.id}><button className="btn-danger btn-sm" onClick={async () => { if (confirm(`Supprimer le match du ${fmtDate(m.date)} (${m.tournament}) ?`)) { await del(`/matches/${m.id}`); setVersion((v) => v + 1); } }}>Supprimer {fmtDate(m.date)} · {m.tournament}</button></li>)}</ul>
      )}
    </div>
  );
}

export function Bulletins({ p }: { p: Player }) {
  const { evals } = useFollowUp(p.id);
  if (!evals) return <div className="grid gap-3" role="status" aria-label="Chargement en cours"><div className="skeleton h-20" /><div className="skeleton h-20" /></div>;
  if (!evals.length) return <p className="rounded-2xl border-2 border-dashed border-line bg-white p-6 text-center text-muted">Aucune évaluation pour l'instant : remplis l'onglet « Évaluations » pour créer un bulletin.</p>;
  return (
    <div className="grid gap-3">
      <p className="hint m-0">Un bulletin est créé pour chaque trimestre évalué. Tu peux l'imprimer ou l'enregistrer en PDF. La famille le voit aussi dans son espace.</p>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {evals.map((e: Evaluation) => {
          const pp = previousPeriod(e.season, e.trimester);
          const before = evals.find((x) => x.season === pp.season && x.trimester === pp.t);
          const avg = overallAverage(e);
          return (
            <li key={e.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div><strong>{periodLabel(e.season, e.trimester)}</strong><p className="m-0 text-sm text-muted">{ratedCount(e) === 0 ? "objectifs évalués" : `${ratedCount(e)} compétences notées · moyenne ${fmtAvg(avg)} / 5`} {trendCommon(e, before)}</p></div>
              <Link to={`/coach/centre/${p.id}/bulletin/${e.season}/${e.trimester}`} className="btn-clay btn-sm no-underline">{e.trimester === 0 ? "Ouvrir le bilan" : "Ouvrir le bulletin"}</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
export { inPeriod };
