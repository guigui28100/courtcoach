import { useEffect, useState } from "react";
import { get } from "../api";
import { Evaluation, EVAL_AXES, EvalAxis, fmtAvg, MatchRow, RATING_LABELS, trend } from "../types";
import { fmtDate } from "../types";

// Chargement des évaluations et matchs d'un joueur (même chose pour le coach et pour la famille : le serveur filtre déjà les droits).
export function useFollowUp(playerId: string, reloadKey = 0) {
  const [evals, setEvals] = useState<Evaluation[] | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  useEffect(() => {
    get<Evaluation[]>(`/players/${playerId}/evaluations`).then(setEvals).catch(() => setEvals([]));
    get<MatchRow[]>(`/players/${playerId}/matches`).then(setMatches).catch(() => setMatches([]));
  }, [playerId, reloadKey]);
  return { evals, matches };
}

// Barres de compétences d'un axe (valeur sur 5, avec flèche si on a la valeur du trimestre précédent)
export function SkillBars({ axis, ev, prev, start }: { axis: EvalAxis; ev: Pick<Evaluation, "ratings">; prev?: Pick<Evaluation, "ratings">; start?: Pick<Evaluation, "ratings"> }) {
  const rows = axis.skills.filter(([k]) => ev.ratings[k]);
  if (!rows.length) return null;
  return (
    <div className="grid gap-2">
      {rows.map(([k, label]) => {
        const v = ev.ratings[k], pv = prev?.ratings[k] ?? 0, sv = start?.ratings[k] ?? 0;
        return (
          <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
            <span className="text-[0.95rem]">{label}</span>
            <span className="text-right text-sm font-bold">{v}/5 {sv ? <small className="font-normal text-muted">(départ {sv}) </small> : null}{pv && v !== pv ? <small aria-label={v > pv ? "en progrès" : "en baisse"}>{v > pv ? "▲" : "▼"}</small> : null}</span>
            <span className="col-span-2 h-2 overflow-hidden rounded-full bg-sand" role="img" aria-label={`${label} : ${v} sur 5, ${RATING_LABELS[v]}`}>
              <span className="block h-full rounded-full" style={{ width: `${(v / 5) * 100}%`, background: axis.color }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MatchTable({ matches }: { matches: MatchRow[] }) {
  if (!matches.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-sand text-left"><th scope="col" className="p-2">Date</th><th scope="col" className="p-2">Rencontre</th><th scope="col" className="p-2">Bilan</th><th scope="col" className="p-2">Score</th></tr></thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id} className="border-b border-line align-top">
              <td className="whitespace-nowrap p-2">{fmtDate(m.date)}</td>
              <td className="p-2">{m.tournament}{m.round && ` · ${m.round}`}{m.remark && <div className="hint">{m.remark}</div>}</td>
              <td className={"p-2 font-bold " + (m.result === "Victoire" ? "text-ok" : "text-bad")}>{m.result}</td>
              <td className="whitespace-nowrap p-2">{m.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const TrendNote = ({ now, before }: { now: number; before: number }) => { const t = trend(now, before); return t ? <span aria-hidden> {t}</span> : null; };
export { EVAL_AXES, fmtAvg };
