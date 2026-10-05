import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { MissionBar, Planet, Stars } from "../components/Galaxy";
import { Radar } from "../components/Radar";
import { BulletinShelf } from "../components/BulletinShelf";
import { SelfEvalSection } from "../components/SelfEval";
import { StarsCard, useStars } from "../components/Stars";
import { useFollowUp } from "../components/Suivi";
import { useVideos, VideoList, VideosIntro, VideoUpload } from "../components/Videos";
import { axisAverage, checkpointAt, currentSeason, EVAL_AXES, goalApplies, isCarriedOver, periodShort, STATUS, statusAt, trimesterOf, fmtAvg, fmtDate, Goal, overallAverage, periodLabel, pendingSelfEval, Player, previousPeriod, ratedCount, SelfEvaluation, trendCommon, VideoRow, CourseStar, starReason, totalStars } from "../types";

// Couleurs claires (lisibles sur fond sombre) et émojis des 4 axes de progression
const MISSION: Record<string, { label: string; emoji: string; color: string }> = {
  TECHNIQUE: { label: "Technique", emoji: "🎾", color: "#ff9b73" },
  TACTIQUE: { label: "Tactique", emoji: "🧠", color: "#7dbbff" },
  PHYSIQUE: { label: "Physique", emoji: "💪", color: "#6ee8aa" },
  MENTAL: { label: "Mental", emoji: "🔥", color: "#d3b2ff" },
};

function Hero({ p, done, wins, starsTotal }: { p: Player; done: number; wins: number; starsTotal: number }) {
  return (
    <section className="gal-pop grid items-center gap-4 sm:grid-cols-[1fr_220px]" aria-labelledby="gal-titre">
      <div className="grid gap-3">
        <p className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-[#dcf247]">Ma galaxie tennis</p>
        <h1 id="gal-titre" className="m-0 text-4xl font-black text-white sm:text-5xl">Salut {p.firstName} !</h1>
        <p className="m-0 max-w-xl text-lg text-white/85">Ici, tu retrouves tes missions du trimestre, tes étoiles, ton bulletin à remplir, tes vidéos (tu en envoies à ton coach, et il peut t'en envoyer) et ton radar de progrès.</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Mes étoiles">
          {starsTotal > 0 && <li className="gal-chip">⭐ {starsTotal} étoile{starsTotal > 1 ? "s" : ""}</li>}
          {done > 0 && <li className="gal-chip">🎯 {done} mission{done > 1 ? "s" : ""} accomplie{done > 1 ? "s" : ""}</li>}
          {wins > 0 && <li className="gal-chip">🏆 {wins} victoire{wins > 1 ? "s" : ""}</li>}
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
                    <div className="flex items-start justify-between gap-2"><strong className="text-white">{g.title}</strong><span className="gal-chip shrink-0" style={st ? { background: STATUS[st].bg, color: STATUS[st].ink } : undefined}>{st ? `${STATUS[st].emoji} ${STATUS[st].label}` : g.progress > 0 ? `${g.progress} %` : "🎯 À travailler"}</span></div>
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

// Onglet « Mes bulletins » : bilan de départ + trimestres, toujours consultables
function BulletinsTab({ p, base, selfEvals, preview }: { p: Player; base: string; selfEvals: SelfEvaluation[]; preview: boolean }) {
  const { evals } = useFollowUp(p.id);
  return (
    <section className="glass gal-pop grid gap-4" aria-labelledby="gal-bulletins">
      <h2 id="gal-bulletins" className="m-0 text-2xl">📄 Mes bulletins</h2>
      <p className="m-0 text-white/85">Ton <strong>bilan de début d'année</strong> et tes <strong>bulletins de chaque trimestre</strong> sont enregistrés ici. Tu peux les ouvrir quand tu veux, pour voir tes progrès.</p>
      {!evals ? <div className="skeleton h-24" role="status" aria-label="Chargement en cours" /> : <BulletinShelf evals={evals} base={base} dark selfEvals={preview ? [] : selfEvals} onSelf={preview ? undefined : () => undefined} />}
    </section>
  );
}

// Aperçu coach : les vidéos de ce joueur et l'état de chaque analyse (le coach les ouvre dans son studio)
function PreviewVideos({ mine }: { mine: VideoRow[] }) {
  return (
    <section className="glass gal-pop grid gap-3" aria-labelledby="gal-videos-apercu">
      <h2 id="gal-videos-apercu" className="m-0 text-2xl">🎬 Mes vidéos</h2>
      <VideosIntro who="apercu" dark />
      {mine.length === 0 ? <p className="m-0 text-white/80">Aucune vidéo pour l'instant.</p> : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {mine.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/10 p-3">
              <span><strong>{v.title}</strong><br /><small className="text-white/75">{v.shot} · {v.fromCoach ? (v.seenAt ? "envoyée par toi, vue par le joueur ✅" : "envoyée par toi, pas encore vue") : v.analysis?.sentAt ? (v.seenAt ? "analyse envoyée et vue ✅" : "analyse envoyée, pas encore vue") : "analyse pas encore envoyée"}</small></span>
              <Link to={`/coach/videos/${v.id}`} className="gal-btn btn-sm no-underline">Ouvrir dans mon studio</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Videos({ p, mine, fresh, refresh }: { p: Player; mine: VideoRow[]; fresh: VideoRow[]; refresh: () => void }) {
  return (
    <section className="gal-pop grid gap-3 rounded-3xl bg-white p-5 text-ink shadow-[0_10px_40px_rgba(76,29,149,0.35)]" aria-labelledby="gal-videos">
      <h2 id="gal-videos" className="m-0 text-2xl">🎬 Mes vidéos</h2>
      <VideosIntro who="jeune" />
      {fresh.some((v) => v.fromCoach && !v.analysis?.sentAt) && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">🎓 Ton coach t'a envoyé {fresh.filter((v) => v.fromCoach && !v.analysis?.sentAt).length > 1 ? "des vidéos" : "une vidéo"} : ouvre-{fresh.filter((v) => v.fromCoach && !v.analysis?.sentAt).length > 1 ? "les" : "la"} ci-dessous !</p>}
      {fresh.some((v) => !!v.analysis?.sentAt) && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">✅ Ton coach a analysé {fresh.filter((v) => !!v.analysis?.sentAt).length > 1 ? `${fresh.filter((v) => !!v.analysis?.sentAt).length} vidéos` : "une vidéo"} : ouvre-la ci-dessous !</p>}
      <VideoUpload playerId={p.id} onDone={refresh} />
      <VideoList videos={mine} onChanged={refresh} empty="Pas encore de vidéo ici. Envoie-en une à ton coach, ou attends celles que ton coach t'enverra !" />
    </section>
  );
}

type Tab = "accueil" | "missions" | "bulletin" | "videos" | "progres" | "bulletins" | "compte";

// Carte cliquable de l'accueil (« à faire » ou « nouveau »)
function Todo({ icon, title, text, onClick, hot = false, children }: { icon: string; title: string; text?: string; onClick: () => void; hot?: boolean; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={"lift grid content-start gap-1 rounded-3xl border p-4 text-left text-white backdrop-blur-md transition-colors " + (hot ? "border-[#dcf247] bg-[#dcf247]/15" : "border-white/20 bg-white/10 hover:bg-white/15")}>
      <span className="text-3xl" aria-hidden="true">{icon}</span>
      <strong className="text-lg">{title}</strong>
      {text && <span className="text-sm text-white/85">{text}</span>}
      {children}
      <span className="mt-1 text-sm font-bold text-[#dcf247]">Ouvrir →</span>
    </button>
  );
}

function HomeTab({ p, goals, done, wins, fresh, sent, pending, stars, go }: { p: Player; goals: Goal[]; done: number; wins: number; fresh: number; sent: number; pending: number | null; stars: CourseStar[]; go: (t: Tab) => void }) {
  const { evals } = useFollowUp(p.id);
  const t = trimesterOf();
  const here = goals.filter((g) => goalApplies(g, t));
  const achieved = here.filter((g) => statusAt(g, t) === "ACHIEVED").length;
  const evaluated = here.some((g) => statusAt(g, t)); // le coach fait le point à la fin du trimestre
  const word = evals?.find((e) => e.appreciation)?.appreciation;
  return (
    <>
      <Hero p={p} done={done} wins={wins} starsTotal={totalStars(stars)} />
      <section className="grid gap-3 sm:grid-cols-2" aria-label="Pour toi aujourd'hui">
        {stars.length > 0 && <Todo icon="⭐" title={`${totalStars(stars)} étoile${totalStars(stars) > 1 ? "s" : ""}`} text={`Dernier cours : +${stars[0].stars} ⭐ ${starReason(stars[0].reason)?.label ?? ""}${stars[0].comment ? ` · « ${stars[0].comment} »` : ""}`} onClick={() => go("progres")} />}
        {sent > 0 && <Todo hot icon="🎓" title={`Ton coach t'a envoyé ${sent > 1 ? `${sent} vidéos` : "une vidéo"} !`} text="Regarde-la, elle est faite pour toi." onClick={() => go("videos")} />}
        {fresh > 0 && <Todo hot icon="🎬" title={`Ton coach a analysé ${fresh > 1 ? `${fresh} vidéos` : "une vidéo"} !`} text="Va voir ses conseils et les images annotées." onClick={() => go("videos")} />}
        <Todo hot={pending !== null} icon={pending !== null ? "✍️" : "📝"} title={pending !== null ? `Remplis ton bulletin du trimestre ${pending}` : "Mon bulletin du trimestre"} text={pending !== null ? "C'est le moment de réfléchir à ton jeu et à ton projet : réponds avec les boutons, ton coach le lira." : "Ton auto-évaluation : en décembre (T1), en mars (T2) et en juin (T3). Pour réfléchir à ton jeu et à ton projet."} onClick={() => go("bulletin")} />
        <Todo icon="🚀" title={here.length ? (evaluated ? `${achieved} mission${achieved > 1 ? "s" : ""} réussie${achieved > 1 ? "s" : ""} sur ${here.length}` : `${here.length} mission${here.length > 1 ? "s" : ""} à travailler`) : "Tes missions"} text={here.length ? (evaluated ? `Trimestre ${t}` : `Trimestre ${t} : ton coach fera le point à la fin du trimestre.`) : "Ton coach va bientôt te donner tes missions."} onClick={() => go("missions")}>
          {here.length > 0 && evaluated && <MissionBar value={Math.round((achieved / here.length) * 100)} color="#dcf247" label="Missions réussies" />}
        </Todo>
        {fresh + sent === 0 && <Todo icon="🎬" title="Mes vidéos" text="Envoie tes vidéos à ton coach. Il peut aussi t'en envoyer." onClick={() => go("videos")} />}
        {word && <Todo icon="💬" title="Le mot de ton coach" text={`« ${word.length > 120 ? word.slice(0, 117) + "…" : word} »`} onClick={() => go("progres")} />}
      </section>
    </>
  );
}

const TABS: [Tab, string, string][] = [["accueil", "🏠", "Accueil"], ["missions", "🚀", "Missions"], ["bulletin", "✍️", "Mon bulletin"], ["videos", "🎬", "Vidéos"], ["progres", "📡", "Progrès"], ["bulletins", "📄", "Mes bulletins"], ["compte", "🔒", "Compte"]];

// Espace du jeune : l'univers « galaxie », avec des onglets pour ne voir qu'une chose à la fois
// previewId : le coach regarde ce que voit un jeune (sans pouvoir envoyer de vidéo), sans avoir besoin de son accès.
export default function YouthSpace({ previewId }: { previewId?: string }) {
  const { me, eraseAccount } = useAuth();
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  const [wins, setWins] = useState<Record<string, number>>({});
  const [version, setVersion] = useState(0);
  const [selfEvals, setSelfEvals] = useState<SelfEvaluation[]>([]);
  const videos = useVideos(version);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => {
    (previewId ? get<Player>(`/players/${previewId}`).then((p) => [p]) : get<Player[]>("/players")).then(async (ps) => {
      setPlayers(ps);
      const g = await Promise.all(ps.map(async (p) => [p.id, await get<Goal[]>(`/players/${p.id}/goals?season=${currentSeason()}`).catch(() => [] as Goal[])] as const));
      setGoals(Object.fromEntries(g));
      const w = await Promise.all(ps.map(async (p) => [p.id, (await get<{ result: string }[]>(`/players/${p.id}/matches`).catch(() => [])).filter((m) => m.result === "Victoire").length] as const));
      setWins(Object.fromEntries(w));
      if (ps[0]) get<SelfEvaluation[]>(`/players/${ps[0].id}/self-evaluations`).then(setSelfEvals).catch(() => setSelfEvals([]));
    }).catch(() => setPlayers([]));
  }, [previewId, version]);

  const p = players?.[0]; // un compte « jeune » n'est relié qu'à sa propre fiche
  const tab: Tab = (TABS.find(([k]) => k === params.get("onglet"))?.[0]) ?? "accueil";
  const go = (t: Tab) => { setParams(t === "accueil" ? {} : { onglet: t }, { replace: false }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const stars = useStars(p?.id, version);
  const mine = (videos ?? []).filter((v) => p && v.player?.id === p.id);
  const fresh = mine.filter((v) => (v.analysis?.sentAt || v.fromCoach) && !v.seenAt); // nouvelle analyse ou nouvelle vidéo du coach
  const freshSent = fresh.filter((v) => v.fromCoach && !v.analysis?.sentAt).length;
  const pending = pendingSelfEval(selfEvals, currentSeason());
  const dot = (k: Tab) => (k === "videos" && fresh.length > 0) || (k === "bulletin" && !previewId && pending !== null);

  return (
    <div className="relative isolate overflow-clip">
      <Stars />
      <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-6">
        {previewId && (
          <p className="glass m-0 flex flex-wrap items-center justify-between gap-2 !p-3 text-sm" role="note">
            <span>👀 <strong>Aperçu coach</strong> : c'est exactement ce que voit {p?.firstName ?? "le jeune"} (sans pouvoir envoyer de vidéo).</span>
            <Link to={`/coach/centre/${previewId}`} className="gal-btn btn-sm no-underline">← Retour au dossier</Link>
          </p>
        )}
        {players === null && <p className="text-center text-white/80">Chargement de ta galaxie…</p>}
        {players?.length === 0 && <div className="glass text-center"><p className="m-0 text-lg">Ton coach n'a pas encore ouvert ton espace. Reviens bientôt !</p></div>}
        {p && (
          <>
            <nav className="gal-tabs" aria-label="Mon espace">
              <div role="tablist">
                {TABS.filter(([k]) => k !== "compte" || !previewId).map(([k, icon, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={(e) => { go(k); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} className={"relative min-h-11 whitespace-nowrap rounded-full border-2 px-4 font-bold transition-colors " + (tab === k ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/30 bg-white/10 text-white hover:bg-white/20")}>
                    <span aria-hidden="true">{icon} </span>{label}
                    {dot(k) && tab !== k && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#0a0d2c] bg-[#ff5d8f]" aria-label="Nouveau" />}
                  </button>
                ))}
              </div>
            </nav>

            <div key={tab} className="gal-pop grid grid-cols-[minmax(0,1fr)] gap-5" role="tabpanel">
              {tab === "accueil" && <HomeTab p={p} goals={goals[p.id] ?? []} done={(goals[p.id] ?? []).filter((g) => g.checkpoints?.some((c) => c.status === "ACHIEVED")).length} wins={wins[p.id] ?? 0} fresh={fresh.length - freshSent} sent={freshSent} pending={pending} stars={stars ?? []} go={go} />}
              {tab === "missions" && <Missions goals={goals[p.id] ?? []} />}
              {tab === "bulletin" && <SelfEvalSection p={p} goals={goals[p.id] ?? []} preview={!!previewId} onSaved={refresh} />}
              {tab === "videos" && (previewId ? <PreviewVideos mine={mine} /> : <Videos p={p} mine={mine} fresh={fresh} refresh={refresh} />)}
              {tab === "progres" && <><StarsCard stars={stars} dark /><Radarlike p={p} bulletinBase={previewId ? `/coach/centre/${p.id}` : `/suivi/${p.id}`} /></>}
              {tab === "bulletins" && <BulletinsTab p={p} base={previewId ? `/coach/centre/${p.id}` : `/suivi/${p.id}`} selfEvals={selfEvals} preview={!!previewId} />}
              {tab === "compte" && !previewId && (
                <section className="glass grid gap-3" aria-labelledby="gal-donnees">
                  <h2 id="gal-donnees" className="m-0 text-2xl">🔒 Mon compte et mes données</h2>
                  <p className="m-0 text-white/85">{me?.email} · <Link to="/confidentialite" className="font-bold text-[#dcf247] underline">Politique de confidentialité</Link></p>
                  <p className="m-0 text-sm text-white/80">Pour demander une copie ou la suppression de ton dossier, parles-en à un parent ou écris au club.</p>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/mot-de-passe" className="btn btn-sm border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">Changer mon mot de passe</Link>
                    <button className="btn btn-sm border-2 border-[#ff9b9b] text-[#ffb4b4] hover:bg-[#b3261e] hover:text-white" onClick={async () => { if (confirm("Supprimer définitivement ton compte (ton dossier reste au club) ?")) { await eraseAccount(); window.location.href = "/"; } }}>Supprimer mon compte</button>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
