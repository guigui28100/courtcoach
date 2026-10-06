import { useState } from "react";
import { put } from "../api";
import { AuthorBadge, ProgressBar } from "./ui";
import { checkpointAt, Goal, GoalCheckpoint, GoalStatus, isCarriedOver, progressAt, STATUS, statusAt } from "../types";

// Évaluation d'un objectif à la fin d'un trimestre : statut, avancement et commentaire du coach (enregistrés au fur et à mesure).
export function GoalEvalCard({ g, t, color, label, onUpdate }: { g: Goal; t: number; color: string; label: string; onUpdate: (g: Goal) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const value = drag ?? progressAt(g, t) ?? 0;
  const cur = checkpointAt(g, t);

  async function save(change: { progress?: number; comment?: string; status?: GoalStatus }) {
    setErr("");
    const progress = change.progress ?? value;
    const status: GoalStatus = change.status ?? (progress >= 100 ? "ACHIEVED" : cur?.status === "ACHIEVED" ? "IN_PROGRESS" : cur?.status ?? "IN_PROGRESS");
    try {
      const cp = await put<GoalCheckpoint>(`/goals/${g.id}/checkpoints/${t}`, { progress: status === "ACHIEVED" ? 100 : progress, status, comment: change.comment ?? cur?.comment ?? "" });
      const cps = [...(g.checkpoints ?? []).filter((c) => c.trimester !== t), cp].sort((u, v) => u.trimester - v.trimester);
      setDrag(null); onUpdate({ ...g, checkpoints: cps, progress: cps[cps.length - 1].progress });
    } catch (x) { setErr((x as Error).message); }
  }

  return (
    <article className="grid gap-2 rounded-xl border border-line border-l-[6px] bg-chalk p-3" style={{ borderLeftColor: color }}>
      <div className="flex flex-wrap items-start justify-between gap-2"><strong>{g.title}</strong><span className="text-sm font-bold" style={{ color }}>{label}</span></div>
      <div className="flex flex-wrap gap-2"><AuthorBadge a={g} prefix="Fixé par" />{checkpointAt(g, t) && <AuthorBadge a={checkpointAt(g, t)} prefix="Évalué par" />}</div>
      {g.indicator && <p className="hint m-0">Mesuré par : {g.indicator}</p>}
      {isCarriedOver(g, t) && <p className="m-0 text-sm font-bold text-[#5b21b6]">🔁 Reconduit depuis le trimestre {t - 1}</p>}
      <div role="radiogroup" aria-label={`Statut de « ${g.title} » au trimestre ${t}`} className="flex flex-wrap gap-2">
        {(Object.keys(STATUS) as GoalStatus[]).map((k) => { const on = statusAt(g, t) === k; return (
          <button key={k} type="button" role="radio" aria-checked={on} onClick={() => save({ status: k })} className={"btn btn-sm " + (on ? "" : "border-2 border-line bg-white text-ink")} style={on ? { background: STATUS[k].bg, color: STATUS[k].ink, border: `2px solid ${STATUS[k].ink}` } : undefined}>{STATUS[k].emoji} {STATUS[k].label}</button>
        ); })}
      </div>
      {!statusAt(g, t) && <p className="hint m-0">Pas encore évalué ce trimestre : choisis un statut.</p>}
      <label className="flex items-center gap-3 text-sm font-bold">Avancement <output>{value} %</output>
        <input type="range" min={0} max={100} step={5} value={value} className="flex-1 accent-clay" onChange={(e) => setDrag(Number(e.target.value))} onPointerUp={(e) => save({ progress: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => save({ progress: Number((e.target as HTMLInputElement).value) })} />
      </label>
      <ProgressBar value={value} color={color} />
      <label className="grid gap-1 text-sm font-bold">Ton commentaire (facultatif)
        <textarea key={`${g.id}-${t}`} className="input !min-h-16 font-normal" maxLength={500} defaultValue={cur?.comment ?? ""} placeholder="Ex. : la première balle passe mieux, à consolider sous pression" onBlur={(e) => e.target.value !== (cur?.comment ?? "") && save({ comment: e.target.value })} />
      </label>
      {err && <p role="alert" className="alert-err m-0">{err}</p>}
    </article>
  );
}
