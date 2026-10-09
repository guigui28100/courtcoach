import { StarsRadar, useStars } from "../components/Stars";
import { useParams, Link } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { get } from "../api";
import { useAuth } from "../auth";
import { CourtMark, Planet, Stars } from "../components/Galaxy";
import { useYouthTheme } from "../components/theme";
import { Radar } from "../components/Radar";
import { MatchTable, SkillBars, useFollowUp } from "../components/Suivi";
import { Empty } from "../components/ui";
import { SelfEvalView } from "../components/SelfEval";
import { useVideos } from "../components/Videos";
import { ageOf, isTeen, AXES, SELF_EVAL_MONTH, selfEvalIsOpen, missionPercent, missionStars, QUALITIES, qualityStars, matchStats, starsByDomain, axisAverage, checkpointAt, currentSeason, isCarriedOver, periodShort, STATUS, statusAt, EVAL_AXES, fmtAvg, fmtDate, fullName, Goal, goalApplies, inPeriod, overallAverage, periodLabel, Player, previousPeriod, progressAt, SelfEvaluation, progressBefore, ratedCount, TRIMESTER_MONTHS, trendCommon } from "../types";

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
  text?.trim() ? <section className="min-w-0 break-inside-avoid rounded-2xl p-4 text-[#1a2233] shadow-md" style={{ background: bg }}><h3 className="m-0 mb-1 text-base" style={{ color: ink }}><span aria-hidden="true">{emoji} </span>{title}</h3><p className="m-0 whitespace-pre-line">{text.trim()}</p></section> : null;

// Bulletin d'un trimestre : même page pour le coach et la famille, à imprimer ou à enregistrer en PDF.
export default function Bulletin() {
  const { id = "", season = currentSeason(), t: tParam = "1" } = useParams();
  const t = [0, 1, 2, 3].includes(Number(tParam)) ? Number(tParam) : 1; // 0 = bilan de début d'année
  const { me } = useAuth();
  const [p, setP] = useState<Player | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [missing, setMissing] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [selfEvals, setSelfEvals] = useState<SelfEvaluation[]>([]);
  const { evals, matches } = useFollowUp(id);
  const allVideos = useVideos();
  const stars = useStars(id);
  useEffect(() => {
    get<Player>(`/players/${id}`).then(setP).catch(() => setMissing(true));
    get<Goal[]>(`/players/${id}/goals?season=${season}`).then(setGoals).catch(() => setGoals([]));
    get<{ signature: string | null }>(`/players/${id}/signature`).then((r) => setSignature(r.signature)).catch(() => setSignature(null));
    get<SelfEvaluation[]>(`/players/${id}/self-evaluations`).then(setSelfEvals).catch(() => setSelfEvals([]));
  }, [id, season]);

  useYouthTheme(isTeen(p)); // thème « ados » à partir de 11 ans
  const staff = me?.role === "COACH" || me?.role === "TRAINER";
  const back = staff ? `/coach/centre/${id}` : "/suivi";
  if (missing) return <div className="mx-auto max-w-3xl p-6"><Empty>Ce bulletin est introuvable.</Empty><Link to={back} className="btn-clay no-underline">Retour</Link></div>;
  if (!p || !evals) return <p className="p-8 text-center text-muted">Chargement…</p>;
  // Le jeune et sa famille voient le bulletin d'un trimestre seulement à partir du 1er décembre (T1), du 1er mars (T2) et du 1er juin (T3)
  if (!staff && t > 0 && !selfEvalIsOpen(season, t)) return <div className="mx-auto max-w-3xl p-6 text-center"><Empty>Le bulletin du trimestre {t} sera disponible en {SELF_EVAL_MONTH[t]}.</Empty><Link to={back} className="btn-clay no-underline">Retour</Link></div>;

  const ev = evals.find((e) => e.season === season && e.trimester === t);
  const pp = previousPeriod(season, t);
  const prev = evals.find((e) => e.season === pp.season && e.trimester === pp.t);
  const short = periodShort;
  const brief = (s: string, n: number) => (n === 0 ? "le bilan de départ" : `T${n} ${s.slice(0, 4)}/${s.slice(7)}`); // « T3 2025/26 » : tient sur une ligne
  const now: Record<string, number> = {}, before: Record<string, number> = {};
  EVAL_AXES.forEach((a) => { now[a.key] = axisAverage(ev, a); before[a.key] = axisAverage(prev, a); });
  const qNow = qualityStars(stars ?? [], season, t);
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
  const LAB = { ACHIEVED: "Atteinte", NOT_ACHIEVED: "Non atteinte", IN_PROGRESS: "En cours" } as const;
  const done = here.filter((g) => statusAt(g, t) === "ACHIEVED").length;
  const progress = here.length ? Math.round(here.reduce((s, g) => s + (at(g) ?? 0), 0) / here.length) : null;
  const age = ageOf(p.birthDate);
  // Bilan de départ : l'en-tête montre toujours l'âge, le classement, le style de jeu et l'objectif de l'année (« — » si pas encore renseigné)
  const facts = (t === 0 ? [["Âge", age !== null ? `${age} ans` : "—"], ["Classement", p.ranking || "—"], ["Style de jeu", p.playStyle || "—"], ["Objectif de l'année", p.targetRanking || "—"], ["Main", p.hand], ["Revers", p.backhand]] : [["Âge", age !== null ? `${age} ans` : null], ["Classement", p.ranking], ["Objectif", p.targetRanking], ["Main", p.hand], ["Revers", p.backhand], ["Style de jeu", p.playStyle]]).filter(([, v]) => v);
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

        <article className="print-exact bul-body overflow-hidden rounded-3xl text-[#1a2233] ring-4 ring-white/60 shadow-[0_20px_60px_rgba(20,16,80,0.6)] print:rounded-none print:shadow-none print:ring-0" aria-label={`Bulletin de ${p.firstName}`}>
          <header className="bulletin-hero grid items-center gap-4 p-6 sm:grid-cols-[1fr_150px] sm:p-8">
            <div className="stars" aria-hidden="true" />
            <div className="relative grid gap-2">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[#dcf247]">{t === 0 ? "Bilan de départ" : "Bulletin"} · Tennis Club Houdan</p>
              <h1 className="m-0 text-4xl font-black text-white sm:text-5xl">{fullName(p)}</h1>
              <p className="m-0 text-lg text-white/90">{periodLabel(season, t)} <span className="text-white/70">· {TRIMESTER_MONTHS[t]}</span></p>
              {facts.length > 0 && <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">{facts.map(([k, v]) => <li key={k} className="gal-chip"><span className="text-white/70">{k}</span> {v}</li>)}</ul>}
            </div>
            {isTeen(p) ? <CourtMark className="relative mx-auto max-w-[150px]" /> : <Planet className="relative mx-auto max-w-[150px]" />}
          </header>

          <div className="grid gap-6 p-6 sm:p-8">
            {t === 0 && ev?.appreciation?.trim() && (
              <blockquote className="bul-word relative m-0 break-inside-avoid rounded-3xl p-5 pr-16">
                  <span aria-hidden="true" className="absolute right-4 top-3 text-4xl">🎾</span>
                  <p className="m-0 text-xl font-semibold leading-snug">« {ev.appreciation.trim()} »</p>
                  <footer className="mt-2 text-sm font-black uppercase tracking-wide text-[#1d4ed8]">💬 Le mot du coach</footer>
                </blockquote>
            )}
            {here.length > 0 && (
              <section className="bul-card grid gap-3" aria-labelledby="bul-missions">
                <div className="grid gap-1.5"><h2 id="bul-missions" className="m-0 text-2xl">🎯 Missions du trimestre</h2><ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Bilan des objectifs">{(["ACHIEVED", "IN_PROGRESS", "NOT_ACHIEVED"] as const).map((k) => { const n = here.filter((g) => statusAt(g, t) === k).length; return n ? <li key={k} className="rounded-full px-3 py-0.5 text-sm font-bold" style={{ background: STATUS[k].bg, color: STATUS[k].ink }}>{STATUS[k].emoji} {n} {LAB[k].toLowerCase()}</li> : null; })}</ul></div>
                <DomainMissions goals={here} render={(g) => { const st = statusAt(g, t); const note = checkpointAt(g, t)?.comment.trim(); return (
                  <li key={g.id} className="grid gap-1">
                    <div className="flex items-start justify-between gap-2"><span>{g.title}</span><span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ background: st ? STATUS[st].bg : "#f1f1f1", color: st ? STATUS[st].ink : "#4b5566" }}>{st ? `${STATUS[st].emoji} ${LAB[st]}` : "Pas encore évaluée"}</span></div>
                    {note && <p className="m-0 rounded-xl bg-[#f3efff] p-2 text-sm"><span aria-hidden="true">💬 </span>{note}</p>}
                  </li>
                ); }} />
              </section>
            )}






            {(rated || t === 0 || (t > 0 && !!ev?.appreciation?.trim())) && (
              <section className="bul-court grid gap-5 rounded-3xl p-4 sm:p-6" aria-labelledby="bul-image">
                <h2 id="bul-image" className="m-0 text-3xl font-black text-white drop-shadow">📸 Image du joueur</h2>
            {rated ? (
                <div className="grid justify-items-center gap-1 break-inside-avoid rounded-3xl bg-white p-3 shadow-[0_10px_28px_rgba(10,30,90,0.35)] ring-4 ring-white/40 sm:mx-auto sm:max-w-md">
                  <Radar series={series} />
                </div>
              ) : t === 0 ? <Empty>Les notes du bilan de départ ne sont pas encore saisies.</Empty> : null}

              {t === 0 && ev && (ev.strengths.trim() || ev.improve.trim()) && (
                <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                  <Tint emoji="⭐" title="Points forts" text={ev.strengths} bg="#e9f9f0" ink="#166534" />
                  <Tint emoji="🎯" title={t === 0 ? "Axes de progrès" : "À travailler"} text={ev.improve} bg="#fff6dc" ink="#8a5a00" />
                </div>
              )}
              {t > 0 && ev?.appreciation?.trim() && (
                <blockquote className="m-0 break-inside-avoid rounded-2xl border-l-8 border-[#7c3aed] bg-[#f3efff] p-5">
                  <p className="m-0 text-xl font-semibold leading-snug">« {ev.appreciation.trim()} »</p>
                  <footer className="mt-2 text-sm font-bold text-[#5b21b6]">💬 Le mot du coach</footer>
                </blockquote>
              )}
              </section>
            )}

            {startGoals.length > 0 && (
              <section className="bul-card grid gap-3" aria-labelledby="bul-t1">
                <div className="grid gap-1"><h2 id="bul-t1" className="m-0 text-2xl">🎯 À travailler au trimestre 1</h2><p className="m-0 text-sm text-muted">Ce que {p.firstName} va travailler en priorité pour commencer la saison, domaine par domaine.</p></div>
                <DomainMissions goals={startGoals} rating={(k) => ev?.ratings?.[k]} render={(g) => <li key={g.id}>{g.title}</li>} />
              </section>
            )}

            {t > 0 && (() => { const st = matchStats(ms); const tile = (emoji: string, big: string, label: string, bg: string, ink: string) => (
              <li className="grid gap-0.5 rounded-2xl p-4 text-center" style={{ background: bg, color: ink }}><span aria-hidden="true" className="text-2xl">{emoji}</span><strong className="font-display text-3xl font-black leading-tight">{big}</strong><span className="text-sm font-bold">{label}</span></li>); return (
              <section className="bul-card grid gap-3 break-inside-avoid" aria-labelledby="bul-matchs">
                <h2 id="bul-matchs" className="m-0 text-2xl">🏟️ Compétition du trimestre</h2>
                <ul className="m-0 grid list-none gap-3 p-0 grid-cols-2 sm:grid-cols-4 print:grid-cols-4">
                  {tile("🎾", String(st.played), st.played > 1 ? "matchs joués" : "match joué", "#f6f4fb", "#10203a")}
                  {tile("🏆", String(st.wins), st.wins > 1 ? "victoires" : "victoire", "#e8f7ee", "#166534")}
                  {tile("😕", String(st.losses), st.losses > 1 ? "défaites" : "défaite", "#fdf0ee", "#93371a")}
                  {tile("🎯", st.bestBeaten ?? "—", "classement le plus élevé battu", "#fff8d6", "#6b4e00")}
                </ul>
                {ms.length === 0 && <p className="m-0 text-sm text-muted">Aucun match enregistré par le coach sur ce trimestre.</p>}
                {ms.length > 0 && <MatchTable matches={ms} />}
                {st.wins > 0 && st.rankedWins === 0 && <p className="m-0 text-sm text-muted">Le classement des adversaires battus n'a pas été renseigné.</p>}
              </section>
            ); })()}


            <div className="bul-card mt-2 grid grid-cols-2 items-end gap-8 break-inside-avoid text-sm text-muted"><div className="grid content-end">{signature ? <img src={signature} alt="Signature du coach" className="mb-1 h-16 w-auto max-w-full justify-self-start object-contain" /> : <div className="h-16" />}<div className="border-t-2 border-[#10203a] pt-1">Signature du coach</div></div><div className="border-t-2 border-[#10203a] pt-1">Signature des parents</div></div>
            <p className="m-0 text-center text-xs text-muted">✦ Tennis Club Houdan · Bulletin généré avec CourtCoach le {fmtDate(new Date().toISOString())} ✦</p>
          </div>
        </article>
      </div>
    </div>
  );
}

// Une seule carte par domaine (technique, tactique, physique, mental), avec dessous ce qu'il y a à travailler
function DomainMissions({ goals, render, rating }: { goals: Goal[]; render: (g: Goal) => ReactNode; rating?: (axisKey: string) => number | undefined }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
      {AXES.map((a) => { const list = goals.filter((g) => g.axis === a.key); if (!list.length) return null; const n = rating?.(a.key.toLowerCase()); return (
        <section key={a.key} className="grid min-w-0 break-inside-avoid content-start gap-2 rounded-2xl p-4 shadow-sm" style={{ borderTop: `6px solid ${a.color}`, backgroundColor: "#ffffff", backgroundImage: `linear-gradient(180deg, ${a.color}26, #ffffff 70%)` }} aria-label={a.label}>
          <h3 className="m-0 flex items-center justify-between gap-2 text-lg" style={{ color: a.color }}><span><span aria-hidden="true">{EMOJI[a.key.toLowerCase()]} </span>{a.label}</span>{n ? <small className="font-body text-muted">{n}/5</small> : null}</h3>
          <ul className="m-0 grid list-disc gap-1.5 pl-5">{list.map(render)}</ul>
        </section>
      ); })}
    </div>
  );
}
