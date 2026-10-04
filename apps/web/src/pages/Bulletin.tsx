import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { get } from "../api";
import { useAuth } from "../auth";
import { Planet, Stars } from "../components/Galaxy";
import { Radar } from "../components/Radar";
import { SkillBars, useFollowUp } from "../components/Suivi";
import { Empty } from "../components/ui";
import { useVideos } from "../components/Videos";
import { axisAverage, currentSeason, EVAL_AXES, fmtAvg, fmtDate, fullName, Goal, inPeriod, overallAverage, periodLabel, Player, previousPeriod, ratedCount, TRIMESTER_MONTHS, trendCommon } from "../types";

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
  text?.trim() ? <section className="break-inside-avoid rounded-2xl p-4" style={{ background: bg }}><h3 className="m-0 mb-1 text-base" style={{ color: ink }}><span aria-hidden="true">{emoji} </span>{title}</h3><p className="m-0 whitespace-pre-line">{text.trim()}</p></section> : null;

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
  const brief = (s: string, n: number) => `T${n} ${s.slice(0, 4)}/${s.slice(7)}`; // « T3 2025/26 » : tient sur une ligne
  const now: Record<string, number> = {}, before: Record<string, number> = {};
  EVAL_AXES.forEach((a) => { now[a.key] = axisAverage(ev, a); before[a.key] = axisAverage(prev, a); });
  const series = [{ label: short(season, t), values: now, color: "#7c3aed" }, ...(prev ? [{ label: short(pp.season, pp.t), values: before, color: "#10203a", dashed: true }] : [])];
  const ms = matches.filter((m) => inPeriod(m.date, season, t));
  const wins = ms.filter((m) => m.result === "Victoire").length;
  const analysed = (allVideos ?? []).filter((v) => v.player?.id === id && v.analysis?.sentAt && inPeriod(v.analysis.sentAt, season, t));
  const done = goals.filter((g) => g.progress >= 100).length;
  const progress = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : null;
  const facts = [["Classement", p.ranking], ["Objectif", p.targetRanking], ["Main", p.hand], ["Revers", p.backhand], ["Style de jeu", p.playStyle]].filter(([, v]) => v);
  const rated = !!ev && ratedCount(ev) > 0;

  return (
    <div className="relative isolate overflow-hidden">
      <div className="print:hidden"><Stars /></div>
      <div className="relative z-10 mx-auto max-w-4xl px-3 py-6 sm:px-4 print:p-0">
        <div className="print:hidden mb-4 flex flex-wrap items-center gap-3">
          <Link to={back} className="font-bold text-white underline">← Retour</Link>
          <button className="gal-btn" onClick={() => window.print()}>🖨️ Imprimer / Enregistrer en PDF</button>
          <p className="m-0 basis-full text-sm text-white/80">Astuce : dans la fenêtre d'impression, choisis « Enregistrer au format PDF » pour l'envoyer par e-mail.</p>
        </div>

        <article className="print-exact overflow-hidden rounded-3xl bg-white text-[#1a2233] shadow-[0_20px_60px_rgba(10,13,44,0.55)] print:rounded-none print:shadow-none" aria-label={`Bulletin de ${p.firstName}`}>
          <header className="bulletin-hero grid items-center gap-4 p-6 sm:grid-cols-[1fr_150px] sm:p-8">
            <div className="stars" aria-hidden="true" />
            <div className="relative grid gap-2">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[#dcf247]">Bulletin · Tennis Club Houdan</p>
              <h1 className="m-0 text-4xl font-black text-white sm:text-5xl">{fullName(p)}</h1>
              <p className="m-0 text-lg text-white/90">{periodLabel(season, t)} <span className="text-white/70">· {TRIMESTER_MONTHS[t]}</span></p>
              {facts.length > 0 && <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">{facts.map(([k, v]) => <li key={k} className="gal-chip"><span className="text-white/70">{k}</span> {v}</li>)}</ul>}
            </div>
            <Planet className="relative mx-auto max-w-[150px]" />
          </header>

          <div className="grid gap-6 p-6 sm:p-8">
            <section className="grid gap-3 sm:grid-cols-3" aria-label="Chiffres clés">
              <div className="flex items-center gap-3 rounded-2xl bg-[#f3efff] p-4">
                {rated ? <Gauge value={overallAverage(ev)} /> : <span className="text-3xl" aria-hidden="true">📊</span>}
                <div><p className="m-0 font-display text-lg font-extrabold leading-tight">Moyenne générale</p><p className="m-0 text-sm text-muted">{rated ? (prev ? `${trendCommon(ev, prev)} depuis ${brief(pp.season, pp.t)}` : "Premier bulletin") : "Pas encore évalué"}</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#fff6dc] p-4">
                <span className="text-4xl" aria-hidden="true">⭐</span>
                <div><p className="m-0 font-display text-3xl font-black leading-none whitespace-nowrap">{done}<span className="text-xl text-muted"> / {goals.length}</span></p><p className="m-0 text-sm text-muted">missions accomplies{progress !== null ? ` · saison à ${progress} %` : ""}</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#e9f9f0] p-4">
                <span className="text-4xl" aria-hidden="true">🏆</span>
                <div><p className="m-0 font-display text-3xl font-black leading-none whitespace-nowrap">{wins}<span className="text-xl text-muted"> / {ms.length}</span></p><p className="m-0 text-sm text-muted">{ms.length ? `victoire${wins > 1 ? "s" : ""} en ${ms.length} match${ms.length > 1 ? "s" : ""}` : "pas de match ce trimestre"}</p></div>
              </div>
            </section>

            {rated ? (
              <section className="grid gap-4" aria-labelledby="bul-comp">
                <h2 id="bul-comp" className="m-0 text-2xl">📊 Compétences</h2>
                <div className="grid gap-5 md:grid-cols-[minmax(0,290px)_1fr] print:grid-cols-[250px_1fr]">
                  <div className="grid content-start justify-items-center gap-1 self-start break-inside-avoid rounded-2xl border border-line p-3">
                    <Radar series={series} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                    {EVAL_AXES.map((a) => {
                      if (!(a.skills.some(([k]) => ev!.ratings[k]) || ev!.comments[a.key])) return null;
                      return (
                        <div key={a.key} className="grid content-start gap-2 break-inside-avoid rounded-2xl border border-line p-3" style={{ borderTop: `5px solid ${a.color}` }}>
                          <h3 className="m-0 flex items-baseline justify-between gap-2 text-base" style={{ color: a.color }}><span><span aria-hidden="true">{EMOJI[a.key]} </span>{a.label}</span><span className="whitespace-nowrap text-sm">{fmtAvg(axisAverage(ev, a))} / 5 {trendCommon(ev, prev, a)}</span></h3>
                          <SkillBars axis={a} ev={ev!} prev={prev} />
                          {ev!.comments[a.key] && <p className="m-0 text-sm text-muted">{ev!.comments[a.key]}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : <Empty>Aucune compétence n'est encore notée pour ce trimestre.</Empty>}

            {ev?.appreciation?.trim() && (
              <blockquote className="m-0 break-inside-avoid rounded-2xl border-l-8 border-[#7c3aed] bg-[#f3efff] p-5">
                <p className="m-0 text-xl font-semibold leading-snug">« {ev.appreciation.trim()} »</p>
                <footer className="mt-2 text-sm font-bold text-[#5b21b6]">💬 Le mot du coach</footer>
              </blockquote>
            )}
            {ev && (ev.strengths.trim() || ev.improve.trim() || ev.next.trim()) && (
              <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
                <Tint emoji="⭐" title="Points forts" text={ev.strengths} bg="#e9f9f0" ink="#166534" />
                <Tint emoji="🎯" title="À travailler" text={ev.improve} bg="#fff6dc" ink="#8a5a00" />
                <Tint emoji="🚀" title="Prochain trimestre" text={ev.next} bg="#f3efff" ink="#5b21b6" />
              </div>
            )}

            {goals.length > 0 && (
              <section className="grid gap-3" aria-labelledby="bul-missions">
                <h2 id="bul-missions" className="m-0 text-2xl">🚀 Missions de la saison</h2>
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 print:grid-cols-2">
                  {goals.map((g) => { const a = EVAL_AXES.find((x) => x.key === g.axis.toLowerCase()); return (
                    <li key={g.id} className="grid break-inside-avoid content-start gap-1.5 rounded-2xl border border-line p-3">
                      <div className="flex items-start justify-between gap-2"><strong>{g.title}</strong><span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ background: g.progress >= 100 ? "#dcf247" : "#f3efff" }}>{g.progress >= 100 ? "⭐ Réussie" : `${g.progress} %`}</span></div>
                      <span className="text-sm font-bold" style={{ color: a?.color }}><span aria-hidden="true">{EMOJI[g.axis.toLowerCase()]} </span>{a?.label}</span>
                      {g.indicator && <span className="text-sm text-muted">{g.indicator}{g.deadline ? ` · avant le ${fmtDate(g.deadline)}` : ""}</span>}
                      <div role="progressbar" aria-valuenow={g.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression : ${g.title}`} className="h-3 overflow-hidden rounded-full bg-[#ece7ff]"><div className="h-full rounded-full" style={{ width: `${g.progress}%`, background: `linear-gradient(90deg, ${a?.color ?? "#7c3aed"}, #dcf247)` }} /></div>
                    </li>
                  ); })}
                </ul>
              </section>
            )}

            {ms.length > 0 && (
              <section className="grid gap-3 break-inside-avoid" aria-labelledby="bul-matchs">
                <h2 id="bul-matchs" className="m-0 text-2xl">🏟️ Compétition du trimestre</h2>
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
