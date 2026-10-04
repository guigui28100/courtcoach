import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { MissionBar, Planet, Stars } from "../components/Galaxy";
import { Radar } from "../components/Radar";
import { useFollowUp } from "../components/Suivi";
import { useVideos, VideoList, VideoUpload } from "../components/Videos";
import { axisAverage, checkpointAt, currentSeason, EVAL_AXES, goalApplies, isCarriedOver, periodShort, STATUS, statusAt, trimesterOf, fmtAvg, fmtDate, Goal, overallAverage, periodLabel, Player, previousPeriod, ratedCount, trendCommon } from "../types";

// Couleurs claires (lisibles sur fond sombre) et émojis des 4 axes de progression
const MISSION: Record<string, { label: string; emoji: string; color: string }> = {
  TECHNIQUE: { label: "Technique", emoji: "🎾", color: "#ff9b73" },
  TACTIQUE: { label: "Tactique", emoji: "🧠", color: "#7dbbff" },
  PHYSIQUE: { label: "Physique", emoji: "💪", color: "#6ee8aa" },
  MENTAL: { label: "Mental", emoji: "🔥", color: "#d3b2ff" },
};

function Hero({ p, done, wins }: { p: Player; done: number; wins: number }) {
  return (
    <section className="gal-pop grid items-center gap-4 sm:grid-cols-[1fr_220px]" aria-labelledby="gal-titre">
      <div className="grid gap-3">
        <p className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-[#dcf247]">Ma galaxie tennis</p>
        <h1 id="gal-titre" className="m-0 text-4xl font-black text-white sm:text-5xl">Salut {p.firstName} !</h1>
        <p className="m-0 max-w-xl text-lg text-white/85">Voici tes missions, tes progrès et le mot de ton coach. Chaque entraînement te fait avancer d'une étoile.</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Mes étoiles">
          <li className="gal-chip">⭐ {done} mission{done > 1 ? "s" : ""} accomplie{done > 1 ? "s" : ""}</li>
          <li className="gal-chip">🏆 {wins} victoire{wins > 1 ? "s" : ""}</li>
          {p.ranking && <li className="gal-chip">🎾 Classement {p.ranking}{p.targetRanking ? ` → objectif ${p.targetRanking}` : ""}</li>}
        </ul>
      </div>
      <Planet className="mx-auto max-w-[220px]" />
    </section>
  );
}

function Missions({ goals }: { goals: Goal[] }) {
  const t = trimesterOf();
  const here = goals.filter((g) => goalApplies(g, t)); // les missions de CE trimestre
  return (
    <section className="glass gal-pop grid gap-4" aria-labelledby="gal-missions">
      <h2 id="gal-missions" className="m-0 text-2xl">🚀 Mes missions du trimestre {t}</h2>
      {here.length === 0 ? <p className="m-0 text-white/80">Ton coach va bientôt te donner tes missions pour ce trimestre.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(["TECHNIQUE", "TACTIQUE", "PHYSIQUE", "MENTAL"] as const).map((axis) => {
            const mine = here.filter((g) => g.axis === axis);
            if (!mine.length) return null;
            const m = MISSION[axis];
            return (
              <div key={axis} className="grid content-start gap-3 rounded-2xl bg-white/10 p-4" style={{ borderTop: `4px solid ${m.color}` }}>
                <h3 className="m-0 text-lg" style={{ color: m.color }}><span aria-hidden="true">{m.emoji} </span>{m.label}</h3>
                {mine.map((g) => { const st = statusAt(g, t), note = checkpointAt(g, t)?.comment.trim(); return (
                  <div key={g.id} className="grid gap-1">
                    <div className="flex items-start justify-between gap-2"><strong className="text-white">{g.title}</strong><span className="gal-chip shrink-0" style={st ? { background: STATUS[st].bg, color: STATUS[st].ink } : undefined}>{st ? `${STATUS[st].emoji} ${STATUS[st].label}` : `${g.progress} %`}</span></div>
                    {isCarriedOver(g, t) && <small className="font-bold text-[#dcf247]">🔁 Mission reconduite depuis le trimestre {t - 1} : on la reprend !</small>}
                    {g.indicator && <small className="text-white/75">Comment on le mesure : {g.indicator}</small>}
                    <MissionBar value={g.progress} color={m.color} label={`Mission : ${g.title}`} />
                    {note && <small className="rounded-lg bg-white/10 p-2 text-white/90"><span aria-hidden="true">💬 </span>{note}</small>}
                  </div>
                ); })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Radarlike({ p, bulletinBase }: { p: Player; bulletinBase: string }) {
  const { evals, matches } = useFollowUp(p.id);
  if (!evals) return null;
  const last = evals.find((e) => ratedCount(e) > 0);
  const prevP = last ? previousPeriod(last.season, last.trimester) : null;
  const prev = last && prevP ? evals.find((e) => e.season === prevP.season && e.trimester === prevP.t) : undefined;
  const now: Record<string, number> = {}, before: Record<string, number> = {};
  const start = last && last.trimester >= 2 ? evals.find((e) => e.season === last.season && e.trimester === 0) : undefined;
  const origin: Record<string, number> = {};
  EVAL_AXES.forEach((a) => { now[a.key] = axisAverage(last, a); before[a.key] = axisAverage(prev, a); origin[a.key] = axisAverage(start, a); });
  return (
    <>
      <section className="glass gal-pop grid gap-4" aria-labelledby="gal-radar">
        <h2 id="gal-radar" className="m-0 text-2xl">📡 {last?.trimester === 0 ? "Mon point de départ" : "Mon radar"}</h2>
        {!last ? <p className="m-0 text-white/80">Ton point de départ et ton premier radar arriveront après les premières évaluations de ton coach.</p> : (
          <div className="grid items-start gap-5 md:grid-cols-[300px_1fr]">
            <div className="grid justify-items-center gap-2">
              <Radar dark series={[{ label: periodShort(last.season, last.trimester), values: now, color: "#dcf247" }, ...(prev && prevP ? [{ label: periodShort(prevP.season, prevP.t), values: before, color: "#ffffff", dashed: true }] : []), ...(start && ratedCount(start) && last.trimester >= 2 ? [{ label: "Départ", values: origin, color: "#ffb24d", dashed: true }] : [])]} />
              <p className="m-0 text-center font-bold">{periodLabel(last.season, last.trimester)}<br />Moyenne {fmtAvg(overallAverage(last))} / 5 {trendCommon(last, prev)}</p>
            </div>
            <div className="grid content-start gap-3">
              {last.appreciation && (
                <blockquote className="m-0 rounded-2xl rounded-bl-none bg-white p-4 text-ink">
                  <p className="m-0 text-lg">« {last.appreciation} »</p><footer className="mt-1 text-sm font-bold text-clay">💬 Le mot de ton coach</footer>
                </blockquote>
              )}
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Mes moyennes par domaine">
                {EVAL_AXES.map((a) => axisAverage(last, a) ? <li key={a.key} className="gal-chip">{a.label} {fmtAvg(axisAverage(last, a))}/5 {trendCommon(last, prev, a)}</li> : null)}
              </ul>
              {last.strengths && <p className="m-0"><strong className="text-[#dcf247]">⭐ Tes points forts : </strong>{last.strengths}</p>}
              {last.improve && <p className="m-0"><strong className="text-[#dcf247]">🎯 Pour progresser : </strong>{last.improve}</p>}
              {last.next && <p className="m-0"><strong className="text-[#dcf247]">🚀 Prochaines missions : </strong>{last.next}</p>}
            </div>
          </div>
        )}
        {evals.some((e) => ratedCount(e) > 0) && (
          <div className="grid gap-2"><h3 className="m-0 text-lg">📄 Mes bulletins</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{evals.filter((e) => ratedCount(e) > 0).map((e) => <li key={e.id}><Link to={`${bulletinBase}/bulletin/${e.season}/${e.trimester}`} className="gal-btn btn-sm no-underline">Trimestre {e.trimester} · {e.season.replace("-", "/")}</Link></li>)}</ul>
          </div>
        )}
      </section>
      {matches.length > 0 && (
        <section className="glass gal-pop grid gap-3" aria-labelledby="gal-matchs">
          <h2 id="gal-matchs" className="m-0 text-2xl">🏟️ Mes matchs</h2>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {matches.map((m) => (
              <li key={m.id} className="grid gap-0.5 rounded-2xl bg-white/10 p-3">
                <span className="flex items-center justify-between gap-2"><strong>{m.tournament}{m.round && ` · ${m.round}`}</strong><span className={"gal-chip " + (m.result === "Victoire" ? "!bg-[#dcf247] !text-ink" : "")}>{m.result === "Victoire" ? "🏆 Victoire" : "💪 Défaite"}</span></span>
                <span className="text-sm text-white/80">{fmtDate(m.date)}{m.score && ` · ${m.score}`}</span>
                {m.remark && <span className="text-sm text-white/80">{m.remark}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Videos({ p }: { p: Player }) {
  const [version, setVersion] = useState(0);
  const videos = useVideos(version);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  const mine = (videos ?? []).filter((v) => v.player?.id === p.id);
  const fresh = mine.filter((v) => v.analysis?.sentAt && !v.seenAt);
  return (
    <section className="gal-pop grid gap-3 rounded-3xl bg-white p-5 text-ink shadow-[0_10px_40px_rgba(76,29,149,0.35)]" aria-labelledby="gal-videos">
      <h2 id="gal-videos" className="m-0 text-2xl">🎬 Mes vidéos</h2>
      {fresh.length > 0 && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">✅ Ton coach a analysé {fresh.length > 1 ? `${fresh.length} vidéos` : "une vidéo"} : ouvre-la ci-dessous !</p>}
      <VideoUpload playerId={p.id} onDone={refresh} />
      <VideoList videos={mine} onChanged={refresh} empty="Pas encore de vidéo. Filme quelques coups et envoie-les à ton coach !" />
    </section>
  );
}

// Espace du jeune : l'univers « galaxie » (même contenu que celui des parents, présenté pour lui)
// previewId : le coach regarde ce que voit un jeune (sans vidéos ni compte), sans avoir besoin de son accès.
export default function YouthSpace({ previewId }: { previewId?: string }) {
  const { me, eraseAccount } = useAuth();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  const [wins, setWins] = useState<Record<string, number>>({});
  useEffect(() => {
    (previewId ? get<Player>(`/players/${previewId}`).then((p) => [p]) : get<Player[]>("/players")).then(async (ps) => {
      setPlayers(ps);
      const g = await Promise.all(ps.map(async (p) => [p.id, await get<Goal[]>(`/players/${p.id}/goals?season=${currentSeason()}`).catch(() => [] as Goal[])] as const));
      setGoals(Object.fromEntries(g));
      const w = await Promise.all(ps.map(async (p) => [p.id, (await get<{ result: string }[]>(`/players/${p.id}/matches`).catch(() => [])).filter((m) => m.result === "Victoire").length] as const));
      setWins(Object.fromEntries(w));
    }).catch(() => setPlayers([]));
  }, [previewId]);

  return (
    <div className="relative isolate overflow-hidden">
      <Stars />
      <div className="relative z-10 mx-auto grid max-w-5xl gap-6 px-4 py-8">
        {previewId && (
          <p className="glass m-0 flex flex-wrap items-center justify-between gap-2 !p-3 text-sm" role="note">
            <span>👀 <strong>Aperçu coach</strong> : c'est exactement ce que voit {players?.[0]?.firstName ?? "le jeune"} (sans ses vidéos ni son compte).</span>
            <Link to={`/coach/centre/${previewId}`} className="gal-btn btn-sm no-underline">← Retour au dossier</Link>
          </p>
        )}
        {players === null && <p className="text-center text-white/80">Chargement de ta galaxie…</p>}
        {players?.length === 0 && <div className="glass text-center"><p className="m-0 text-lg">Ton coach n'a pas encore ouvert ton espace. Reviens bientôt !</p></div>}
        {players?.map((p) => (
          <div key={p.id} className="grid gap-6">
            <Hero p={p} done={(goals[p.id] ?? []).filter((g) => g.checkpoints?.some((c) => c.status === "ACHIEVED")).length} wins={wins[p.id] ?? 0} />
            <Missions goals={goals[p.id] ?? []} />
            <Radarlike p={p} bulletinBase={previewId ? `/coach/centre/${p.id}` : `/suivi/${p.id}`} />
            {previewId ? (
              <section className="glass gal-pop grid gap-2" aria-label="Mes vidéos"><h2 className="m-0 text-2xl">🎬 Mes vidéos</h2><p className="m-0 text-white/80">Ici, le jeune envoie ses vidéos et retrouve tes analyses.</p></section>
            ) : <Videos p={p} />}
          </div>
        ))}
        {!previewId && <section className="glass grid gap-3" aria-labelledby="gal-donnees">
          <h2 id="gal-donnees" className="m-0 text-lg">🔒 Mon compte et mes données</h2>
          <p className="m-0 text-sm text-white/80">{me?.email} · <Link to="/confidentialite" className="font-bold text-[#dcf247] underline">Politique de confidentialité</Link> · Pour demander une copie ou la suppression de ton dossier, parles-en à un parent ou écris au club.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/mot-de-passe" className="btn btn-sm border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">Changer mon mot de passe</Link>
            <button className="btn btn-sm border-2 border-[#ff9b9b] text-[#ffb4b4] hover:bg-[#b3261e] hover:text-white" onClick={async () => { if (confirm("Supprimer définitivement ton compte (ton dossier reste au club) ?")) { await eraseAccount(); window.location.href = "/"; } }}>Supprimer mon compte</button>
          </div>
        </section>}
      </div>
    </div>
  );
}
