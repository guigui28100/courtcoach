import { Link } from "react-router-dom";
import { checkpointAt, Goal, goalApplies, Evaluation, fmtAvg, overallAverage, ratedCount, SELF_EVAL_MONTH, SelfEvaluation, trimesterOf, currentSeason } from "../types";

// Un bulletin existe vraiment quand le coach y a écrit ou noté quelque chose (une ligne vide créée par un point de contrôle ne compte pas)
export const hasContent = (e: Evaluation | undefined) => !!e && (ratedCount(e) > 0 || !!(e.appreciation || e.strengths || e.improve || e.next));

// Un trimestre a aussi un bulletin quand le coach a évalué des missions (même sans notes de compétences)
const missionsDone = (goals: Goal[], season: string, t: number) => t > 0 && season === currentSeason() && goals.some((g) => goalApplies(g, t) && !!checkpointAt(g, t));

const LABEL = ["Bilan de départ", "Trimestre 1", "Trimestre 2", "Trimestre 3"];
const WHEN = ["septembre", "décembre", "mars", "juin"];

// « Mes bulletins » : tout l'historique reste là, à relire quand on veut (bilan de départ + 3 trimestres par saison, saisons passées comprises)
export function BulletinShelf({ evals, base, dark = false, selfEvals = [], onSelf, famille = false, goals = [] }: { goals?: Goal[]; evals: Evaluation[]; base: string; dark?: boolean; selfEvals?: SelfEvaluation[]; onSelf?: () => void; famille?: boolean }) {
  const cur = currentSeason(), nowT = trimesterOf();
  const seasons = [...new Set([cur, ...evals.filter(hasContent).map((e) => e.season)])].sort().reverse();
  const card = dark ? "border-white/20 bg-white/10 text-white" : "border-line bg-white text-ink";
  const muted = dark ? "text-white/75" : "text-muted";
  return (
    <div className="grid gap-4">
      {seasons.map((season) => (
        <section key={season} className="grid gap-2" aria-label={`Saison ${season.replace("-", "/")}`}>
          <h3 className="m-0 text-lg">Saison {season.replace("-", "/")}{season === cur && <small className={"ml-2 font-normal " + muted}>(en cours)</small>}</h3>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((t) => {
              const e = evals.find((x) => x.season === season && x.trimester === t);
              const ready = hasContent(e) || missionsDone(goals, season, t);
              if (!ready && season !== cur) return null; // pas de case vide pour les saisons passées
              const sent = t > 0 && selfEvals.some((s) => s.season === season && s.trimester === t && s.sentAt);
              return (
                <li key={t} className={"grid content-between gap-2 rounded-2xl border p-3 " + (ready ? card : (dark ? "border-dashed border-white/25 text-white/60" : "border-dashed border-line bg-sand/40 text-muted"))}>
                  <span className="grid gap-0.5">
                    <strong>{ready ? "📄" : "🔒"} {LABEL[t]}</strong>
                    <small className={muted}>{ready && e && ratedCount(e) > 0 ? `Moyenne ${fmtAvg(overallAverage(e))} / 5` : ready ? "missions évaluées" : t === 0 ? "pas encore fait" : season === cur && t === nowT ? `en cours · prévu en ${WHEN[t]}` : `prévu en ${WHEN[t]}`}</small>
                    {t > 0 && onSelf && <small className={muted}>{sent ? "✍️ Mon auto-évaluation : envoyée ✅" : season === cur ? `✍️ Auto-évaluation : à remplir en ${SELF_EVAL_MONTH[t]}` : ""}</small>}
                  </span>
                  {ready && <Link to={`${base}/bulletin/${season}/${t}`} className={dark ? "gal-btn btn-sm text-center no-underline" : "btn-outline btn-sm text-center no-underline"}>Voir le bulletin</Link>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className={"m-0 text-sm " + muted}>{famille ? "Les bulletins sont gardés toute l'année et les années suivantes : vous pouvez les relire, les imprimer ou les enregistrer en PDF quand vous voulez." : "Tes bulletins sont gardés toute l'année et les années suivantes : tu peux les relire, les imprimer ou les enregistrer en PDF quand tu veux."}</p>
    </div>
  );
}
