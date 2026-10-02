import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { get } from "../api";
import { useAuth } from "../auth";
import { Radar } from "../components/Radar";
import { MatchTable, SkillBars, useFollowUp } from "../components/Suivi";
import { Empty } from "../components/ui";
import { useVideos } from "../components/Videos";
import { axisAverage, currentSeason, EVAL_AXES, fmtAvg, fmtDate, fullName, Goal, inPeriod, overallAverage, periodLabel, Player, previousPeriod, ratedCount, TRIMESTER_MONTHS, trendCommon } from "../types";

const Block = ({ title, text }: { title: string; text?: string }) => (text?.trim() ? <section className="break-inside-avoid"><h2 className="mb-1 text-lg">{title}</h2><p className="m-0 whitespace-pre-line">{text.trim()}</p></section> : null);

// Bulletin d'un trimestre : même page pour le coach et la famille, à imprimer ou à enregistrer en PDF.
export default function Bulletin() {
  const { id = "", season = currentSeason(), t: tParam = "1" } = useParams();
  const t = [1, 2, 3].includes(Number(tParam)) ? Number(tParam) : 1;
  const { me } = useAuth();
  const [p, setP] = useState<Player | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [missing, setMissing] = useState(false);
  const { evals, matches } = useFollowUp(id);
  const allVideos = useVideos();
  useEffect(() => {
    get<Player>(`/players/${id}`).then(setP).catch(() => setMissing(true));
    get<Goal[]>(`/players/${id}/goals?season=${season}`).then(setGoals).catch(() => setGoals([]));
  }, [id, season]);

  const back = me?.role === "COACH" ? `/coach/centre/${id}` : "/suivi";
  if (missing) return <div className="mx-auto max-w-3xl p-6"><Empty>Ce bulletin est introuvable.</Empty><Link to={back} className="btn-clay no-underline">Retour</Link></div>;
  if (!p || !evals) return <p className="p-8 text-center text-muted">Chargement…</p>;

  const ev = evals.find((e) => e.season === season && e.trimester === t);
  const pp = previousPeriod(season, t);
  const prev = evals.find((e) => e.season === pp.season && e.trimester === pp.t);
  const short = (s: string, n: number) => `T${n} ${s.replace("-", "/")}`;
  const now: Record<string, number> = {}, before: Record<string, number> = {};
  EVAL_AXES.forEach((a) => { now[a.key] = axisAverage(ev, a); before[a.key] = axisAverage(prev, a); });
  const series = [{ label: short(season, t), values: now, color: "#b8471f" }, ...(prev ? [{ label: short(pp.season, pp.t), values: before, color: "#10203a", dashed: true }] : [])];
  const ms = matches.filter((m) => inPeriod(m.date, season, t));
  const analysed = (allVideos ?? []).filter((v) => v.player?.id === id && v.analysis?.sentAt && inPeriod(v.analysis.sentAt, season, t));
  const progress = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : null;
  const facts = [["Classement", p.ranking], ["Objectif de classement", p.targetRanking], ["Main", p.hand], ["Revers", p.backhand], ["Style de jeu", p.playStyle], ["Entraînement", p.training]].filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="print:hidden mb-4 flex flex-wrap items-center gap-3">
        <Link to={back} className="font-bold text-ink underline">← Retour</Link>
        <button className="btn-clay" onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>
        <p className="hint m-0 basis-full">Astuce : dans la fenêtre d'impression, choisis « Enregistrer au format PDF » pour l'envoyer par e-mail.</p>
      </div>
      <article className="grid gap-5 rounded-2xl border border-line bg-white p-6 print:rounded-none print:border-0 print:p-0" aria-label={`Bulletin de ${p.firstName}`}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-4 border-clay pb-4">
          <div><h1 className="m-0 text-2xl sm:text-3xl">{fullName(p)}</h1><p className="m-0 text-muted">Bulletin de compétences et de progression</p></div>
          <div className="text-right"><strong className="font-display text-lg">Tennis Club Houdan</strong><p className="m-0">{periodLabel(season, t)}</p><p className="hint m-0">{TRIMESTER_MONTHS[t]}</p></div>
        </header>
        {facts.length > 0 && <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">{facts.map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="m-0 font-bold">{v}</dd></div>)}</dl>}

        {!ev || !ratedCount(ev) ? <Empty>Aucune compétence n'est encore notée pour ce trimestre.</Empty> : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,300px)_1fr] print:grid-cols-[260px_1fr]">
            <section className="break-inside-avoid">
              <h2 className="text-lg">Vue d'ensemble</h2>
              <Radar series={series} />
              <p className="m-0 text-center font-bold">Moyenne générale : {fmtAvg(overallAverage(ev))} / 5</p>
              {prev && <p className="m-0 text-center text-sm text-muted">{trendCommon(ev, prev)} par rapport à {short(pp.season, pp.t)}</p>}
            </section>
            <section className="grid content-start gap-4">
              <h2 className="text-lg">Compétences</h2>
              {EVAL_AXES.map((a) => {
                const has = a.skills.some(([k]) => ev.ratings[k]) || ev.comments[a.key];
                if (!has) return null;
                return (
                  <div key={a.key} className="grid gap-2 break-inside-avoid border-l-4 pl-3" style={{ borderLeftColor: a.color }}>
                    <h3 className="m-0 flex items-baseline justify-between gap-2 text-base" style={{ color: a.color }}>{a.label}<span className="text-sm">{fmtAvg(axisAverage(ev, a))} / 5 {trendCommon(ev, prev, a)}</span></h3>
                    <SkillBars axis={a} ev={ev} prev={prev} />
                    {ev.comments[a.key] && <p className="hint m-0">{ev.comments[a.key]}</p>}
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {ev && <><Block title="Appréciation du coach" text={ev.appreciation} /><Block title="Points forts" text={ev.strengths} /><Block title="À travailler" text={ev.improve} /></>}
        {goals.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-1 text-lg">Objectifs de la saison · {progress} % atteints</h2>
            <ul className="m-0 grid list-none gap-2 p-0">
              {goals.map((g) => { const a = EVAL_AXES.find((x) => x.key === g.axis.toLowerCase()); return (
                <li key={g.id} className="text-[0.95rem]"><strong style={{ color: a?.color }}>{a?.label} :</strong> {g.title} — <strong>{g.progress} %</strong>{g.indicator && <span className="hint block">{g.indicator}</span>}</li>
              ); })}
            </ul>
          </section>
        )}
        {ms.length > 0 && <section className="break-inside-avoid"><h2 className="mb-2 text-lg">Compétition du trimestre</h2><MatchTable matches={ms} /></section>}
        {analysed.length > 0 && (
          <section className="grid gap-3"><h2 className="m-0 text-lg">Analyses vidéo du trimestre</h2>
            {analysed.map((v) => (
              <div key={v.id} className="break-inside-avoid rounded-xl border border-line p-3">
                <h3 className="m-0 text-base">{v.title} · {fmtDate(v.analysis!.sentAt!)}</h3>
                {v.analysis!.goalIds.length > 0 && <p className="m-0 text-sm"><strong>Objectifs travaillés : </strong>{goals.filter((g) => v.analysis!.goalIds.includes(g.id)).map((g) => g.title).join(" ; ")}</p>}
                {v.analysis!.observation && <p className="m-0 whitespace-pre-line">{v.analysis!.observation}</p>}
                {v.analysis!.strengths && <p className="m-0"><strong>Points forts : </strong>{v.analysis!.strengths}</p>}
                {v.analysis!.improve && <p className="m-0"><strong>À améliorer : </strong>{v.analysis!.improve}</p>}
              </div>
            ))}
          </section>
        )}
        {ev && <Block title="Objectifs du trimestre suivant" text={ev.next} />}
        <div className="mt-6 grid grid-cols-2 gap-6 break-inside-avoid text-sm text-muted"><div className="min-h-20 border-t border-ink pt-1">Signature du coach</div><div className="min-h-20 border-t border-ink pt-1">Signature des parents</div></div>
        <p className="hint m-0 text-center">Tennis Club Houdan · Bulletin généré avec CourtCoach le {fmtDate(new Date().toISOString())}</p>
      </article>
    </div>
  );
}
