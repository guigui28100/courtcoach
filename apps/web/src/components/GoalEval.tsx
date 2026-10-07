import { useState } from "react";
import { put } from "../api";
import { AuthorBadge, ProgressBar } from "./ui";
import { checkpointAt, CourseStar, Goal, GoalCheckpoint, GoalStatus, isCarriedOver, missionPercent, missionStars, STATUS } from "../types";

// Évaluation d'une mission à la fin du trimestre : « atteinte » ou « non atteinte », aidée par le pourcentage d'étoiles gagnées sur la mission, plus le commentaire du coach (enregistrés au fur et à mesure).
export function GoalEvalCard({ g, t, season, stars, color, label, onUpdate }: { g: Goal; t: number; season: string; stars: CourseStar[]; color: string; label: string; onUpdate: (g: Goal) => void }) {
  const [err, setErr] = useState("");
  const cur = checkpointAt(g, t);
  const target = g.targetStars ?? 10, earned = missionStars(stars, g.id, season, t), pct = missionPercent(earned, target);
  const advice: GoalStatus = pct >= 100 ? "ACHIEVED" : "IN_PROGRESS";
  const status = cur?.status === "ACHIEVED" || cur?.status === "NOT_ACHIEVED" ? cur.status : null; // l'ancien « en progrès » compte comme « pas encore évalué »

  async function save(change: { status?: GoalStatus; comment?: string }) {
    setErr("");
    const st = change.status ?? status ?? advice;
    try {
      const cp = await put<GoalCheckpoint>(`/goals/${g.id}/checkpoints/${t}`, { progress: st === "ACHIEVED" ? 100 : pct, status: st, comment: change.comment ?? cur?.comment ?? "" });
      const cps = [...(g.checkpoints ?? []).filter((c) => c.trimester !== t), cp].sort((u, v) => u.trimester - v.trimester);
      onUpdate({ ...g, checkpoints: cps, progress: cps[cps.length - 1].progress });
    } catch (x) { setErr((x as Error).message); }
  }

  return (
    <article className="grid gap-2 rounded-xl border border-line border-l-[6px] bg-chalk p-3" style={{ borderLeftColor: color }}>
      <div className="flex flex-wrap items-start justify-between gap-2"><strong>{g.title}</strong><span className="text-sm font-bold" style={{ color }}>{label}</span></div>
      <div className="flex flex-wrap gap-2"><AuthorBadge a={g} prefix="Fixé par" />{checkpointAt(g, t) && <AuthorBadge a={checkpointAt(g, t)} prefix="Évalué par" />}</div>
      {g.indicator && <p className="hint m-0">Mesuré par : {g.indicator}</p>}
      {isCarriedOver(g, t) && <p className="m-0 text-sm font-bold text-[#5b21b6]">🔁 Reconduit depuis le trimestre {t - 1}</p>}
      <div className="grid gap-1 rounded-xl bg-white p-2">
        <p className="m-0 flex flex-wrap items-baseline justify-between gap-2 text-sm font-bold"><span>⭐ {earned} étoile{earned > 1 ? "s" : ""} sur {target} à gagner</span><span>{pct} %</span></p>
        <ProgressBar value={pct} color={color} />
        <p className="hint m-0">{pct >= 100 ? "Objectif d'étoiles atteint : « atteinte » est conseillé." : `Il manque ${target - earned} étoile${target - earned > 1 ? "s" : ""} : « en cours » est conseillé pour l'instant.`} La décision t'appartient.</p>
      </div>
      <div role="radiogroup" aria-label={`Bilan de « ${g.title} » au trimestre ${t}`} className="flex flex-wrap gap-2">
        {(["ACHIEVED", "IN_PROGRESS", "NOT_ACHIEVED"] as GoalStatus[]).map((k) => { const on = status === k; return (
          <button key={k} type="button" role="radio" aria-checked={on} onClick={() => save({ status: k })} className={"btn btn-sm " + (on ? "" : "border-2 border-line bg-white text-ink")} style={on ? { background: STATUS[k].bg, color: STATUS[k].ink, border: `2px solid ${STATUS[k].ink}` } : undefined}>
            {k === "ACHIEVED" ? "✅ Atteinte" : k === "IN_PROGRESS" ? "🔄 En cours" : "❌ Non atteinte"}{!status && k === advice ? " · conseillé" : ""}
          </button>
        ); })}
      </div>
      {!status && <p className="hint m-0">Pas encore évaluée ce trimestre : choisis « atteinte », « en cours » ou « non atteinte ».</p>}
      <label className="grid gap-1 text-sm font-bold">Ton commentaire (facultatif)
        <textarea key={`${g.id}-${t}`} className="input !min-h-16 font-normal" maxLength={500} defaultValue={cur?.comment ?? ""} placeholder="Ex. : la première balle passe mieux, à consolider sous pression" onBlur={(e) => e.target.value !== (cur?.comment ?? "") && save({ comment: e.target.value })} />
      </label>
      {err && <p role="alert" className="alert-err m-0">{err}</p>}
    </article>
  );
}
