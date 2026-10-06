import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { get } from "../api";
import { useAuth } from "../auth";
import { Planet, Stars } from "../components/Galaxy";
import { Radar } from "../components/Radar";
import { SkillBars, useFollowUp } from "../components/Suivi";
import { Empty } from "../components/ui";
import { SelfEvalView } from "../components/SelfEval";
import { useVideos } from "../components/Videos";
import { axisAverage, checkpointAt, currentSeason, isCarriedOver, periodShort, STATUS, statusAt, EVAL_AXES, fmtAvg, fmtDate, fullName, Goal, goalApplies, inPeriod, overallAverage, periodLabel, Player, previousPeriod, progressAt, SelfEvaluation, progressBefore, ratedCount, TRIMESTER_MONTHS, trendCommon } from "../types";

const EMOJI: Record<string, string> = { technique: "🎾", tactique: "🧠", physique: "💪", mental: "🔥", attitude: "🤝" };

// Anneau de la moyenne générale (sur 5)
function Gauge({ value }: { value: number }) {
  const r = 40, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, value / 5));
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" role="img" aria-label={`Moyenne générale : ${fmtAvg(value)} sur 5`}>
      <defs><linearGradient id="bul-gauge" x1="0" x2="1"><stop offset="0" stopColor="#7c3aed" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e7e0ff" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="url(#bul-gauge)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="49" textAnchor="middle" fontSize="25" fontWeight="800" fill="#10203a">{fmtAvg(value)}</text>
      <text x="50" y="67" textAnchor="middle" fontSize="11" fill="#4b5566">sur 5</text>
    </svg>
  );
}

const Tint = ({ emoji, title, text, bg, ink }: { emoji: string; title: string; text?: string; bg: string; ink: string }) =>
  text?.trim() ? <section className="min-w-0 break-inside-avoid rounded-2xl p-4" style={{ background: bg }}><h3 className="m-0 mb-1 text-base" style={{ color: ink }}><span aria-hidden="true">{emoji} </span>{title}</h3><p className="m-0 whitespace-pre-line">{text.trim()}</p></section> : null;

// Bulletin d'un trimestre : même page pour le coach et la famille, à imprimer ou à enregistrer en PDF.
export default function Bulletin() {
  const { id = "", season = currentSeason(), t: tParam = "1" } = useParams();
  const t = [0, 1, 2, 3].includes(Number(tParam)) ? Number(tParam) : 1; // 0 = bilan de début d'année
  const { me } = useAuth();
  const [p, setP] = useState<Player | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [missing, setMissing] = useState(false);
  const [selfEvals, setSelfEvals] = useState<SelfEvaluation[]>([]);
  const { evals, matches } = useFollowUp(id);
  const allVideos = useVideos();
  useEffect(() => {
    get<Player>(`/players/${id}`).then(setP).catch(() => setMissing(true));
    get<Goal[]>(`/players/${id}/goals?season=${season}`).then(setGoals).catch(() => setGoals([]));
    get<SelfEvaluation[]>(`/players/${id}/self-evaluations`).then(setSelfEvals).catch(() => setSelfEvals([]));
  }, [id, season]);

  const staff = me?.role === "COACH" || me?.role === "TRAINER";
  const back = staff ? `/coach/centre/${id}` : "/suivi";
  if (missing) return <div className="mx-auto max-w-3xl p-6"><Empty>Ce bulletin est introuvable.</Empty><Link to={back} className="btn-clay no-underline">Retour</Link></div>;
  if (!p || !evals) return <p className="p-8 text-center text-muted">Chargement…</p>;

  const ev = evals.find((e) => e.season === season && e.trimester === t);
  const pp = previousPeriod(season, t);
  const prev = evals.find((e) => e.season === pp.season && e.trimester === pp.t);
  const short = periodShort;
  const brief = (s: string, n: number) => (n === 0 ? "le bilan de départ" : `T${n} ${s.slice(0, 4)}/${s.slice(7)}`); // « T3 2025/26 » : tient sur une ligne
  const now: Record<string, number> = {}, before: Record<string, number> = {};
  EVAL_AXES.forEach((a) => { now[a.key] = axisAverage(ev, a); before[a.key] = axisAverage(prev, a); });
  // Radar : maintenant, le trimestre précédent, et le point de départ de la saison (bilan de début d'année) quand il est différent
  const start = t >= 2 ? evals.find((e) => e.season === season && e.trimester === 0) : undefined;
  const origin: Record<string, number> = {};
  EVAL_AXES.forEach((a) => { origin[a.key] = axisAverage(start, a); });
  const series = [{ label: short(season, t), values: now, color: "#7c3aed" }, ...(prev ? [{ label: short(pp.season, pp.t), values: before, color: "#10203a", dashed: true }] : []), ...(start && ratedCount(start) ? [{ label: "Départ", values: origin, color: "#e08a00", dashed: true }] : [])];
  const ms = matches.filter((m) => inPeriod(m.date, season, t));
  const wins = ms.filter((m) => m.result === "Victoire").length;
  const analysed = (allVideos ?? []).filter((v) => v.player?.id === id && v.analysis?.sentAt && inPeriod(v.analysis.sentAt, season, t));
  // Objectifs « à travailler » ce trimestre, avec où ils en sont à la fin du trimestre (point de contrôle du coach)
  const here = t === 0 ? [] : goals.filter((g) => goalApplies(g, t)); // le bilan de départ n'a pas encore d'objectifs
  const startGoals = t === 0 ? goals.filter((g) => goalApplies(g, 1)) : []; // le bilan de départ annonce ce qui sera à travailler au trimestre 1
  const at = (g: Goal) => progressAt(g, t);
  const done = here.filter((g) => statusAt(g, t) === "ACHIEVED").length;
  const progress = here.length ? Math.round(here.reduce((s, g) => s + (at(g) ?? 0), 0) / here.length) : null;
  const facts = [["Classement", p.ranking], ["Objectif", p.targetRanking], ["Main", p.hand], ["Revers", p.backhand], ["Style de jeu", p.playStyle]].filter(([, v]) => v);
  const rated = !!ev && ratedCount(ev) > 0;

  // Carte d'un domaine de compétences (l'attitude est placée sous le radar, les autres domaines à côté)
  const axisCard = (a: (typeof EVAL_AXES)[number]) => {
    if (!ev || !(a.skills.some(([k]) => ev.ratings[k]) || ev.comments[a.key])) return null;
    return (
      <div key={a.key} className="grid content-start gap-2 break-inside-avoid rounded-2xl border border-line p-3" style={{ borderTop: `5px solid ${a.color}` }}>
        <h3 className="m-0 flex items-baseline justify-between gap-2 text-base" style={{ color: a.color }}><span><span aria-hidden="true">{EMOJI[a.key]} </span>{a.label}</span><span className="whitespace-nowrap text-sm">{fmtAvg(axisAverage(ev, a))} / 5 {trendCommon(ev, prev, a)}</span></h3>
        <SkillBars axis={a} ev={ev} prev={prev} start={start} />
        {ev.comments[a.key] && <p className="m-0 text-sm text-muted">{ev.comments[a.key]}</p>}
      </div>
    );
  };

  return (
    <div className="relative isolate overflow-hidden">
      <div className="print:hidden"><Stars /></div>
      <div className="relative z-10 mx-auto max-w-4xl px-3 py-6 sm:px-4 print:p-0">
        <div className="print:hidden mb-4 flex flex-wrap items-center gap-3">
          <Link to={back} className="font-bold text-white underline">← Retour</Link>
          <button className="gal-btn" onClick={() => window.print()}>🖨️ Imprimer / Enregistrer en PDF</button>
          {staff && <Link to={`/coach/centre/${id}/apercu`} className="btn btn-sm border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">👀 Voir comme le jeune</Link>}
          <p className="m-0 basis-full text-sm text-white/80">Astuce : dans la fenêtre d'impression, choisis « Enregistrer au format PDF » pour l'envoyer par e-mail.</p>
        </div>

        <article className="print-exact overflow-hidden rounded-3xl bg-white text-[#1a2233] shadow-[0_20px_60px_rgba(10,13,44,0.55)] print:rounded-none print:shadow-none" aria-label={`Bulletin de ${p.firstName}`}>
          <header className="bulletin-hero grid items-center gap-4 p-6 sm:grid-cols-[1fr_150px] sm:p-8">
            <div className="stars" aria-hidden="true" />
            <div className="relative grid gap-2">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[#dcf247]">{t === 0 ? "Bilan de départ" : "Bulletin"} · Tennis Club Houdan</p>
              <h1 className="m-0 text-4xl font-black text-white sm:text-5xl">{fullName(p)}</h1>
              <p className="m-0 text-lg text-white/90">{periodLabel(season, t)} <span className="text-white/70">· {TRIMESTER_MONTHS[t]}</span></p>
              {facts.length > 0 && <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">{facts.map(([k, v]) => <li key={k} className="gal-chip"><span className="text-white/70">{k}</span> {v}</li>)}</ul>}
            </div>
            <Planet className="relative mx-auto max-w-[150px]" />
          </header>

          <div className="grid gap-6 p-6 sm:p-8">
            {here.length > 0 && (
              <section className="grid gap-3" aria-labelledby="bul-missions">
                <div className="grid gap-1.5"><h2 id="bul-missions" className="m-0 text-2xl">🎯 Objectifs du trimestre</h2><ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Bilan des objectifs">{(["ACHIEVED", "IN_PROGRESS", "NOT_ACHIEVED"] as const).map((k) => { const n = here.filter((g) => statusAt(g, t) === k).length; return n ? <li key={k} className="rounded-full px-3 py-0.5 text-sm font-bold" style={{ background: STATUS[k].bg, color: STATUS[k].ink }}>{STATUS[k].emoji} {n} {STATUS[k].label.toLowerCase()}</li> : null; })}</ul><p className="m-0 text-sm text-muted">Ce que {p.firstName} avait à travailler et le bilan de chaque objectif à la fin du trimestre.</p></div>
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 print:grid-cols-2">
                  {here.map((g) => { const a = EVAL_AXES.find((x) => x.key === g.axis.toLowerCase()); const v = at(g); const st = statusAt(g, t); const carried = isCarriedOver(g, t); const before = progressBefore(g, t); const note = checkpointAt(g, t)?.comment.trim(); return (
                    <li key={g.id} className="grid break-inside-avoid content-start gap-1.5 rounded-2xl border border-line p-3">
                      <div className="flex items-start justify-between gap-2"><strong>{g.title}</strong><span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ background: st ? STATUS[st].bg : "#f1f1f1", color: st ? STATUS[st].ink : "#4b5566" }}>{st ? `${STATUS[st].emoji} ${STATUS[st].label}` : "Pas encore évalué"}</span></div>
                      {carried && <span className="text-sm font-bold text-[#5b21b6]">🔁 Reconduit depuis le trimestre {t - 1}</span>}
                      <span className="text-sm font-bold" style={{ color: a?.color }}><span aria-hidden="true">{EMOJI[g.axis.toLowerCase()]} </span>{a?.label}</span>
                      {g.indicator && <span className="text-sm text-muted">Objectif mesuré par : {g.indicator}{g.deadline ? ` · avant le ${fmtDate(g.deadline)}` : ""}</span>}
                      {v !== null && <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={`Où il en est : ${g.title}`} className="h-3 overflow-hidden rounded-full bg-[#ece7ff]"><div className="h-full rounded-full" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${a?.color ?? "#7c3aed"}, #dcf247)` }} /></div>}
                      {v !== null && before !== null && <span className="text-sm font-bold" style={{ color: v > before ? "#166534" : "#4b5566" }}>{v > before ? `▲ +${v - before} points depuis le trimestre précédent` : v < before ? `▼ ${v - before} points depuis le trimestre précédent` : "= stable depuis le trimestre précédent"}</span>}
                      {note && <p className="m-0 rounded-xl bg-[#f3efff] p-2 text-sm"><span aria-hidden="true">💬 </span>{note}</p>}
                    </li>
                  ); })}
                </ul>
              </section>
            )}

            {startGoals.length > 0 && (
              <section className="grid gap-3" aria-labelledby="bul-t1">
                <div className="grid gap-1"><h2 id="bul-t1" className="m-0 text-2xl">🎯 Objectifs à travailler au trimestre 1</h2><p className="m-0 text-sm text-muted">Ce que {p.firstName} va travailler en priorité pour commencer la saison.</p></div>
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 print:grid-cols-2">
                  {startGoals.map((g) => { const a = EVAL_AXES.find((x) => x.key === g.axis.toLowerCase()); return (
                    <li key={g.id} className="grid min-w-0 break-inside-avoid content-start gap-1.5 rounded-2xl border border-line p-3" style={{ borderTop: `5px solid ${a?.color ?? "#7c3aed"}` }}>
                      <strong>{g.title}</strong>
                      <span className="text-sm font-bold" style={{ color: a?.color }}><span aria-hidden="true">{EMOJI[g.axis.toLowerCase()]} </span>{a?.label}</span>
                      {g.indicator && <span className="text-sm text-muted">Objectif mesuré par : {g.indicator}{g.deadline ? ` · avant le ${fmtDate(g.deadline)}` : ""}</span>}
                    </li>
                  ); })}
                </ul>
              </section>
            )}

            {ev?.next?.trim() && <Tint emoji="🚀" title={t === 0 ? "Pistes d'objectifs pour le trimestre 1" : "Pour le trimestre suivant"} text={ev.next} bg="#f3efff" ink="#5b21b6" />}

            {(() => { const se = t > 0 ? selfEvals.find((e) => e.season === season && e.trimester === t && e.sentAt) : undefined; return se ? (
              <section className="grid min-w-0 gap-2 break-inside-avoid rounded-2xl border-2 border-[#d9ccff] p-4" aria-labelledby="bul-regard">
                <h2 id="bul-regard" className="m-0 text-xl">💬 Le regard de {p.firstName} sur son trimestre</h2>
                <SelfEvalView ev={se} goals={here} />
              </section>
            ) : null; })()}

            {(rated || t === 0 || !!ev?.strengths?.trim() || !!ev?.improve?.trim() || !!ev?.appreciation?.trim()) && (
              <section className="grid gap-5 rounded-3xl border-2 border-[#d9ccff] p-4 sm:p-5" aria-labelledby="bul-image">
                <h2 id="bul-image" className="m-0 text-2xl">📸 Image du joueur</h2>
              {rated && (
                <div className="flex items-center gap-3 rounded-2xl bg-[#f3efff] p-4 sm:max-w-sm">
                  <Gauge value={overallAverage(ev)} />
                  <div><p className="m-0 font-display text-lg font-extrabold leading-tight">Moyenne générale</p><p className="m-0 text-sm text-muted">{t === 0 ? "Point de départ de la saison" : prev ? `${trendCommon(ev, prev)} depuis ${brief(pp.season, pp.t)}` : "Premier bulletin"}</p></div>
                </div>
              )}
            {rated ? (
                <div className="grid gap-4">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,290px)_1fr] print:grid-cols-[250px_1fr]">
                    <div className="grid content-start gap-3 self-start">
                      <div className="grid content-start justify-items-center gap-1 break-inside-avoid rounded-2xl border border-line p-3">
                        <Radar series={series} />
                      </div>
                      {EVAL_AXES.filter((a) => a.key === "attitude").map(axisCard)}
                    </div>
                    <div className="grid content-start gap-3 sm:grid-cols-2 print:grid-cols-2">
                      {EVAL_AXES.filter((a) => a.key !== "attitude").map(axisCard)}
                    </div>
                  </div>
                </div>
              ) : t === 0 ? <Empty>Les compétences du bilan de départ ne sont pas encore notées.</Empty> : null}

              {ev && (ev.strengths.trim() || ev.improve.trim()) && (
                <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                  <Tint emoji="⭐" title="Points forts" text={ev.strengths} bg="#e9f9f0" ink="#166534" />
                  <Tint emoji="🎯" title={t === 0 ? "Axes de progrès" : "À travailler"} text={ev.improve} bg="#fff6dc" ink="#8a5a00" />
                </div>
              )}
            {ev?.appreciation?.trim() && (
                <blockquote className="m-0 break-inside-avoid rounded-2xl border-l-8 border-[#7c3aed] bg-[#f3efff] p-5">
                  <p className="m-0 text-xl font-semibold leading-snug">« {ev.appreciation.trim()} »</p>
                  <footer className="mt-2 text-sm font-bold text-[#5b21b6]">💬 Le mot du coach</footer>
                </blockquote>
              )}
              </section>
            )}

            {ms.length > 0 && (
              <section className="grid gap-3 break-inside-avoid" aria-labelledby="bul-matchs">
                <h2 id="bul-matchs" className="m-0 text-2xl">🏟️ Compétition du trimestre{ms.length > 0 && <span className="ml-2 text-base font-bold text-[#166534]">· 🏆 {wins} victoire{wins > 1 ? "s" : ""} en {ms.length} match{ms.length > 1 ? "s" : ""}</span>}</h2>
                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 print:grid-cols-2">
                  {ms.map((m) => (
                    <li key={m.id} className="grid gap-0.5 rounded-2xl bg-[#f6f4fb] p-3">
                      <span className="flex items-center justify-between gap-2"><strong>{m.tournament}{m.round && ` · ${m.round}`}</strong><span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ background: m.result === "Victoire" ? "#dcf247" : "#e7e0ff" }}>{m.result === "Victoire" ? "🏆 Victoire" : "💪 Défaite"}</span></span>
                      <span className="text-sm text-muted">{fmtDate(m.date)}{m.score && ` · ${m.score}`}</span>
                      {m.remark && <span className="text-sm text-muted">{m.remark}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {analysed.length > 0 && (
              <section className="grid gap-3" aria-labelledby="bul-videos">
                <h2 id="bul-videos" className="m-0 text-2xl">🎬 Analyses vidéo du trimestre</h2>
                {analysed.map((v) => (
                  <div key={v.id} className="grid gap-1.5 break-inside-avoid rounded-2xl border border-line p-4">
                    <h3 className="m-0 text-base">{v.title} <span className="font-normal text-muted">· {fmtDate(v.analysis!.sentAt!)}</span></h3>
                    {v.analysis!.goalIds.length > 0 && <p className="m-0 text-sm"><strong>Missions travaillées : </strong>{goals.filter((g) => v.analysis!.goalIds.includes(g.id)).map((g) => g.title).join(" ; ")}</p>}
                    {v.analysis!.observation && <p className="m-0 whitespace-pre-line">{v.analysis!.observation}</p>}
                    {v.analysis!.strengths && <p className="m-0"><strong>⭐ Points forts : </strong>{v.analysis!.strengths}</p>}
                    {v.analysis!.improve && <p className="m-0"><strong>🎯 À améliorer : </strong>{v.analysis!.improve}</p>}
                    {v.images.length > 0 && <div className="mt-1 grid grid-cols-2 gap-2">{v.images.slice(0, 4).map((i) => <figure key={i.id} className="m-0 break-inside-avoid"><img src={`/api/videos/${v.id}/images/${i.id}`} alt={i.note || "Image annotée"} className="w-full rounded-lg" />{i.note && <figcaption className="mt-0.5 text-xs text-muted">{i.note}</figcaption>}</figure>)}</div>}
                  </div>
                ))}
              </section>
            )}

            <div className="mt-2 grid grid-cols-2 gap-8 break-inside-avoid text-sm text-muted"><div className="min-h-20 border-t-2 border-[#10203a] pt-1">Signature du coach</div><div className="min-h-20 border-t-2 border-[#10203a] pt-1">Signature des parents</div></div>
            <p className="m-0 text-center text-xs text-muted">✦ Tennis Club Houdan · Bulletin généré avec CourtCoach le {fmtDate(new Date().toISOString())} ✦</p>
          </div>
        </article>
      </div>
    </div>
  );
}
