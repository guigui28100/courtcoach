import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, post, put } from "../api";
import { CoachDeclaredMatches } from "./DeclaredMatches";
import { GoalEvalCard } from "./GoalEval";
import { CoachSelfEval } from "./SelfEval";
import { Radar } from "./Radar";
import { hasContent } from "./BulletinShelf";
import { MatchTable, useFollowUp } from "./Suivi";
import { AuthorBadge, Err, Field } from "./ui";
import { RANKINGS, AXES, axisAverage, currentSeason, Goal, goalApplies, Evaluation, EVAL_AXES, fmtAvg, inPeriod, MatchRow, periodLabel, periodShort, previousPeriod, Player, RATING_LABELS, ratedCount, trimesterOf, TOTAL_SKILLS, trendCommon, overallAverage, fmtDate } from "../types";

const seasonsAround = () => { const y = Number(currentSeason().slice(0, 4)); return [`${y - 1}-${y}`, `${y}-${y + 1}`, `${y + 1}-${y + 2}`]; };

function PeriodPicker({ season, t, onChange }: { season: string; t: number; onChange: (s: string, t: number) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="field"><label htmlFor="pp-season" className="sr-only">Saison</label><select id="pp-season" className="input !w-auto" value={season} onChange={(e) => onChange(e.target.value, t)}>{seasonsAround().map((s) => <option key={s} value={s}>Saison {s.replace("-", "/")}</option>)}</select></div>
      <div className="field"><label htmlFor="pp-t" className="sr-only">Trimestre</label><select id="pp-t" className="input !w-auto" value={t} onChange={(e) => onChange(season, Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? "Bilan de début d'année" : `Trimestre ${n}`}</option>)}</select></div>
    </div>
  );
}

export function Evaluations({ p, onSaved }: { p: Player; onSaved?: () => void }) {
  const [season, setSeason] = useState(currentSeason());
  const [t, setT] = useState(trimesterOf());
  const [version, setVersion] = useState(0);
  const { evals } = useFollowUp(p.id, version);
  const saved = evals?.find((e) => e.season === season && e.trimester === t);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
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
  const startDone = hasContent(evals?.find((e) => e.season === currentSeason() && e.trimester === 0));
  return (
    <div className="grid gap-4">
      {evals && season === currentSeason() && (
        <section className={"card flex flex-wrap items-center justify-between gap-3 border-2 " + (startDone ? "border-line" : "!border-clay")} aria-label="Bilan de départ">
          <div className="grid gap-1">
            <h3 className="m-0">📍 Bilan de départ de {p.firstName} (début de saison)</h3>
            <p className="m-0 text-sm text-muted">{startDone ? "Déjà rempli : le jeune le voit en haut de son onglet Missions." : "Pas encore rempli. C'est le point de départ de la saison : tu notes ses compétences, il le verra dans son onglet Missions."}</p>
          </div>
          <button type="button" className={t === 0 ? "btn-ink btn-sm" : "btn-clay"} disabled={t === 0} onClick={() => { setSeason(currentSeason()); setT(0); }}>{t === 0 ? "Tu es sur le bilan de départ ↓" : startDone ? "Modifier le bilan de départ" : "Saisir le bilan de départ"}</button>
        </section>
      )}
      {t === 0 && <p className="alert m-0"><strong>Bilan de début d'année.</strong> C'est le point de départ de la saison : note toutes les compétences en septembre. Il apparaîtra sur le radar des bulletins pour mesurer la progression du jeune.</p>}
      {t > 0 && <CoachSelfEval p={p} season={season} t={t} goals={here} onPick={(s, n) => { setSeason(s); setT(n); }} />}
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker season={season} t={t} onChange={(s, n) => { setSeason(s); setT(n); }} />
        {t === 0 && <p className="m-0 font-bold">{count} compétence{count > 1 ? "s" : ""} notée{count > 1 ? "s" : ""} sur {TOTAL_SKILLS}</p>}
        {saved && <AuthorBadge a={saved} prefix="Dernière saisie :" />}
        {saved && <Link to={`/coach/centre/${p.id}/bulletin/${season}/${t}`} className="btn-outline btn-sm no-underline">{t === 0 ? "Voir le bilan" : "Voir le bulletin"}</Link>}
      </div>

      {t > 0 && (
        <section className="card grid gap-3" aria-labelledby="ev-objectifs">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="ev-objectifs" className="m-0 text-xl">🎯 Missions fixées pour le trimestre {t}</h2><p className="hint m-0">Ce sont les missions que tu as fixées dans l'onglet Objectifs. Pour chacune, indique où elle en est : statut, avancement et ton commentaire. C'est enregistré tout de suite et <strong>figure automatiquement sur le bulletin du trimestre {t}</strong>.</p></div>
            <Link to={`/coach/centre/${p.id}/bulletin/${season}/${t}`} className="btn-outline btn-sm no-underline">Voir le bulletin du trimestre {t}</Link></div>
          {here.length === 0 ? <p className="alert m-0">Aucun objectif n'est prévu au trimestre {t}. Fixe-les dans l'onglet <strong>Objectifs</strong>.</p> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {here.map((g) => <GoalEvalCard key={`${g.id}-${t}`} g={g} t={t} color={axisOf(g)?.color ?? "#7c3aed"} label={axisOf(g)?.label ?? ""} onUpdate={(n) => { setGoals((l) => l.map((x) => (x.id === n.id ? n : x))); setVersion((v) => v + 1); }} />)}
            </div>
          )}
        </section>
      )}

      <form onSubmit={save} className="grid gap-4" noValidate key={`${season}-${t}-${evals ? "ok" : "chargement"}`}>
        <fieldset className="card grid gap-3"><legend className="px-2 font-display text-lg font-bold">{t === 0 ? "Synthèse du bilan de départ" : "Synthèse du trimestre"}</legend>
          <Field label={t === 0 ? "Premier regard sur le joueur" : "Appréciation générale"} id="appreciation"><textarea id="appreciation" name="appreciation" className="input" maxLength={3000} defaultValue={saved?.appreciation ?? ""} /></Field>
          <Field label="Points forts" id="strengths"><textarea id="strengths" name="strengths" className="input" maxLength={3000} defaultValue={saved?.strengths ?? ""} /></Field>
          <Field label={t === 0 ? "Axes de progrès" : "À travailler"} id="improve"><textarea id="improve" name="improve" className="input" maxLength={3000} defaultValue={saved?.improve ?? ""} /></Field>
          <Field label={t === 0 ? "Pistes d'objectifs pour le trimestre 1" : "Objectifs du trimestre suivant"} id="next"><textarea id="next" name="next" className="input" maxLength={3000} defaultValue={saved?.next ?? ""} /></Field>
        </fieldset>
        <details className="card" open={t === 0}>
          <summary className="cursor-pointer font-display text-lg font-bold">📊 Compétences {t === 0 ? "" : "(facultatif) "}· {count} notée{count > 1 ? "s" : ""} sur {TOTAL_SKILLS}</summary>
          <p className="hint mt-2">{t === 0 ? "Note les 21 compétences : c'est le point de départ de la saison." : "Tu peux aussi réévaluer les compétences pour que le radar du bulletin suive la progression ; sinon, laisse vide."}</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-4">
          {EVAL_AXES.map((a) => (
            <fieldset key={a.key} className="card grid gap-3 border-t-[6px]" style={{ borderTopColor: a.color }}>
              <legend className="px-2 font-display text-lg font-bold" style={{ color: a.color }}>{a.label} <small className="font-body text-muted">· moyenne {fmtAvg(axisAverage({ ratings }, a))}</small></legend>
              {a.skills.map(([k, label]) => (
                <div key={k} role="radiogroup" aria-label={label} className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span className="font-bold">{label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className={"flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 font-display font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink " + (ratings[k] === n ? "border-clay bg-clay text-white" : "border-line bg-white text-ink hover:border-ink")} title={RATING_LABELS[n]}>
                        <input type="radio" name={`r-${k}`} className="sr-only" checked={ratings[k] === n} onChange={() => setRatings((r) => ({ ...r, [k]: n }))} aria-label={`${n} sur 5, ${RATING_LABELS[n]}`} />{n}
                      </label>
                    ))}
                    {ratings[k] ? <button type="button" className="ml-1 min-h-11 px-2 text-sm text-muted underline" onClick={() => setRatings((r) => { const c = { ...r }; delete c[k]; return c; })}>Effacer</button> : null}
                  </div>
                </div>
              ))}
              <Field label={`Commentaire ${a.label.toLowerCase()} (facultatif)`} id={`c-${a.key}`}><textarea id={`c-${a.key}`} className="input" maxLength={500} value={comments[a.key] ?? ""} onChange={(e) => setComments((c) => ({ ...c, [a.key]: e.target.value }))} /></Field>
            </fieldset>
          ))}
            </div>
        <aside className="card h-fit lg:sticky lg:top-24" aria-label="Aperçu en direct"><h3 className="mb-2 mt-0">Aperçu</h3><Radar series={series} /></aside>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-3"><button className="btn-clay">{t === 0 ? "Enregistrer le bilan" : "Enregistrer la synthèse et les compétences"}</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
      </form>
    </div>
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
