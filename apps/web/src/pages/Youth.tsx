import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { CourtMark, MissionBar, Planet, Stars } from "../components/Galaxy";
import { useYouthTheme } from "../components/theme";
import { Radar } from "../components/Radar";
import { BulletinShelf, hasContent } from "../components/BulletinShelf";
import { FamilyTournaments } from "../components/Tournaments";
import { DeclaredMatchesSection } from "../components/DeclaredMatches";
import { SelfEvalSection } from "../components/SelfEval";
import { StarsRadar, useStars } from "../components/Stars";
import { useFollowUp } from "../components/Suivi";
import { useVideos, VideoList, VideosIntro, VideoUpload } from "../components/Videos";
import { isTeen, missionPercent, missionStars, axisAverage, checkpointAt, currentSeason, EVAL_AXES, goalApplies, isCarriedOver, periodShort, STATUS, statusAt, trimesterOf, fmtAvg, fmtDate, Goal, overallAverage, periodLabel, pendingSelfEval, Player, previousPeriod, ratedCount, SelfEvaluation, trendCommon, VideoRow, CourseStar, starReason, totalStars } from "../types";

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
        <p className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-[#dcf247]">{isTeen(p) ? "Mon espace joueur" : "Ma galaxie tennis"}</p>
        <h1 id="gal-titre" className="m-0 text-4xl font-black text-white sm:text-5xl">{isTeen(p) ? `${p.firstName}` : `Salut ${p.firstName} !`}</h1>
        <p className="m-0 max-w-xl text-lg text-white/85">{isTeen(p) ? "Tes missions du trimestre, tes étoiles, tes bulletins, tes vidéos et ta progression : tout ton suivi au même endroit." : "Ici, tu retrouves tes missions du trimestre, tes étoiles, ton bulletin à remplir, tes vidéos (tu en envoies à ton coach, et il peut t'en envoyer) et ton radar de progrès."}</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Mes étoiles">
          {starsTotal > 0 && <li className="gal-chip">⭐ {starsTotal} étoile{starsTotal > 1 ? "s" : ""}</li>}
          {done > 0 && <li className="gal-chip">🎯 {done} mission{done > 1 ? "s" : ""} accomplie{done > 1 ? "s" : ""}</li>}
          {wins > 0 && <li className="gal-chip">🏆 {wins} victoire{wins > 1 ? "s" : ""}</li>}
          {p.ranking && <li className="gal-chip">🎾 Classement {p.ranking}{p.targetRanking ? ` → objectif ${p.targetRanking}` : ""}</li>}
        </ul>
      </div>
      {isTeen(p) ? <CourtMark className="mx-auto max-w-[220px]" /> : <Planet className="mx-auto max-w-[220px]" />}
    </section>
  );
}

// « Mon point de départ » : le bilan de début d'année que le coach a rempli, affiché avec les missions
function StartBilan({ p, base }: { p: Player; base: string }) {
  const { evals } = useFollowUp(p.id);
  if (!evals) return null;
  const season = currentSeason();
  const start = evals.find((e) => e.season === season && e.trimester === 0);
  const ready = hasContent(start);
  return (
    <section className="glass gal-pop grid gap-4" aria-labelledby="gal-depart">
      <h2 id="gal-depart" className="m-0 text-2xl">📍 Mon point de départ</h2>
      {!ready || !start ? <p className="m-0 text-white/80">Ton coach va faire ton <strong>bilan de début d'année</strong> : ce que tu sais déjà bien et ce que tu vas travailler. Tu le verras ici dès qu'il sera prêt.</p> : (
        <div className="grid items-start gap-5 md:grid-cols-[300px_1fr]">
          <div className="grid justify-items-center gap-2">
            <Radar dark series={[{ label: "Départ", values: Object.fromEntries(EVAL_AXES.map((a) => [a.key, axisAverage(start, a)])), color: "#dcf247" }]} />
            <p className="m-0 text-center font-bold">Bilan de début d'année · saison {season.replace("-", "/")}</p>
          </div>
          <div className="grid content-start gap-3">
            <p className="m-0 text-white/85">C'est ton coach qui l'a rempli : c'est là que tu commences la saison. Tes missions viennent de là, et tu pourras voir ta progression au fil des trimestres.</p>
            {start.appreciation && <blockquote className="m-0 rounded-2xl rounded-bl-none bg-white p-4 text-ink"><p className="m-0 text-lg">« {start.appreciation} »</p><footer className="mt-1 text-sm font-bold text-clay">💬 Le mot de ton coach</footer></blockquote>}
            {start.strengths && <p className="m-0"><strong className="text-[#dcf247]">⭐ Tes points forts : </strong>{start.strengths}</p>}
            {start.improve && <p className="m-0"><strong className="text-[#dcf247]">🎯 Pour progresser : </strong>{start.improve}</p>}
            <div><Link to={`${base}/bulletin/${season}/0`} className="gal-btn btn-sm no-underline">Voir mon bilan de départ en entier</Link></div>
          </div>
        </div>
      )}
    </section>
  );
}

function Missions({ goals, p, base, stars }: { goals: Goal[]; p: Player; base: string; stars: CourseStar[] | null }) {
  const t = trimesterOf();
  const here = goals.filter((g) => goalApplies(g, t)); // les missions de CE trimestre
  return (
    <section className="glass gal-pop grid gap-4" aria-labelledby="gal-missions">
      <h2 id="gal-missions" className="m-0 text-2xl">🚀 Mes missions du trimestre {t}</h2>
      {here.length === 0 ? <p className="m-0 text-white/80">Ton coach va bientôt te donner tes missions pour ce trimestre.</p> : (
        <ol className="m-0 grid list-none gap-3 p-0">
          {(["TECHNIQUE", "TACTIQUE", "PHYSIQUE", "MENTAL"] as const).flatMap((axis) => here.filter((g) => g.axis === axis)).map((g) => {
            const m = MISSION[g.axis as "TECHNIQUE" | "TACTIQUE" | "PHYSIQUE" | "MENTAL"];
            return (
              <li key={g.id} className="grid gap-1 rounded-2xl bg-white/10 p-4" style={{ borderLeft: `6px solid ${m.color}` }}>
                <span className="text-sm font-bold" style={{ color: m.color }}><span aria-hidden="true">{m.emoji} </span>{m.label}</span>
                <strong className="text-xl leading-snug text-white">{g.title}</strong>
                {g.indicator && <span className="text-white/85">{g.indicator}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// Onglet « Progrès » : le point de départ (fixe) à côté du radar des étoiles (qui grandit à chaque cours), puis le détail des étoiles
// Couleur d'une mission selon ses étoiles : rouge vif → orange → jaune → vert foncé → vert clair (mission terminée)
const BANDS = [
  { max: 20, color: "#ff2d2d", word: "On démarre !" },
  { max: 40, color: "#ff8a1f", word: "Ça avance" },
  { max: 60, color: "#ffd21f", word: "À mi-chemin" },
  { max: 80, color: "#1f8f3f", word: "Presque !" },
  { max: 101, color: "#8bf06b", word: "Tu y es presque !" },
];
const bandOf = (pct: number) => BANDS.find((b) => pct < b.max) ?? BANDS[BANDS.length - 1];

// Une étoile « reconnue » : jour + mission + nombre + raison (si le coach corrige un jour, les mêmes étoiles ne retombent pas)
const starSig = (s: CourseStar) => `${s.day}|${s.goalId ?? ""}|${s.stars}|${s.reason}`;
const MAX_FALLING = 12; // au-delà, les étoiles s'ajoutent d'un coup (pas de pluie interminable)

// Onglet « Progrès » : chaque mission du trimestre, une par une, qui change de couleur à mesure que les étoiles arrivent.
// À l'ouverture, les étoiles reçues depuis la dernière visite tombent du haut jusqu'à leur mission ; la barre change de couleur quand l'étoile arrive.
function MissionProgress({ goals, stars, playerId, preview }: { goals: Goal[]; stars: CourseStar[] | null; playerId: string; preview: boolean }) {
  const t = trimesterOf();
  const here = (["TECHNIQUE", "TACTIQUE", "PHYSIQUE", "MENTAL"] as const).flatMap((axis) => goals.filter((g) => g.axis === axis && goalApplies(g, t)));
  const root = useRef<HTMLElement>(null);
  const rows = useRef<Record<string, HTMLLIElement | null>>({});
  const ran = useRef(-1); // dernier « lancement » de l'animation (0 = à l'ouverture, puis +1 à chaque « Revoir »)
  const [replay, setReplay] = useState(0);
  const [pending, setPending] = useState<Record<string, number>>({}); // étoiles qui n'ont pas encore atterri, par mission
  const [drops, setDrops] = useState<{ key: string; goalId: string; x: number; dy: number; delay: number }[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!stars || !here.length || ran.current === replay) return;
    ran.current = replay;
    const storeKey = `cc-stars-seen-${playerId}`;
    let seen = new Set<string>(); try { seen = new Set(JSON.parse(localStorage.getItem(storeKey) || "[]")); } catch { /* stockage indisponible : on anime tout */ }
    if (!preview) { try { localStorage.setItem(storeKey, JSON.stringify(stars.slice(0, 400).map(starSig))); } catch { /* ignoré */ } }
    const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !root.current) return;
    // aperçu du coach : rien n'est mémorisé, toutes les étoiles sur missions retombent à chaque ouverture (ou à chaque « Revoir »)
    const fresh = stars.filter((s) => s.goalId && s.stars > 0 && here.some((g) => g.id === s.goalId) && (preview || !seen.has(starSig(s)))).reverse(); // les plus anciennes d'abord
    if (!fresh.length) return;
    const base = root.current.getBoundingClientRect();
    const pend: Record<string, number> = {}; const list: typeof drops = [];
    for (const s of fresh) for (let i = 0; i < s.stars && list.length < MAX_FALLING; i++) {
      const row = rows.current[s.goalId!]; if (!row) continue;
      const r = row.getBoundingClientRect(), g = here.find((x) => x.id === s.goalId)!;
      const pct = missionPercent(missionStars(stars, g.id, currentSeason(), t), g.targetStars ?? 10);
      list.push({ key: `${s.id}-${i}`, goalId: s.goalId!, x: r.left - base.left + 16 + (Math.min(pct, 96) / 100) * (r.width - 32), dy: r.top - base.top + 14, delay: list.length * 650 });
      pend[s.goalId!] = (pend[s.goalId!] ?? 0) + 1;
    }
    if (!list.length) return;
    // une étoile qui tombe vaut ce qu'elle a rapporté : on retire du total affiché ce qui va « tomber »
    const worth: Record<string, number> = {}; for (const s of fresh) if (s.goalId) worth[s.goalId] = (worth[s.goalId] ?? 0) + s.stars;
    setFlash(null);
    setPending(Object.fromEntries(Object.keys(pend).map((k) => [k, Math.min(pend[k], worth[k])])));
    setDrops(list);
  }, [stars, here.length, playerId, preview, replay]); // eslint-disable-line react-hooks/exhaustive-deps

  function landed(goalId: string, key: string) {
    setDrops((d) => d.filter((x) => x.key !== key));
    setPending((p) => ({ ...p, [goalId]: Math.max(0, (p[goalId] ?? 0) - 1) }));
    setFlash(goalId); window.setTimeout(() => setFlash((f) => (f === goalId ? null : f)), 700);
  }

  return (
    <section ref={root} className="glass gal-pop relative grid gap-4" aria-labelledby="gal-mp">
      <h2 id="gal-mp" className="m-0 text-2xl">🚀 Mes missions, une par une</h2>
      <p className="m-0 text-white/85">Chaque étoile que ton coach te donne sur une mission la fait avancer. <span className="whitespace-nowrap">🔴 → 🟠 → 🟡 → 🟢</span> : plus la couleur devient verte, plus tu es proche d'avoir réussi !</p>
      {preview && here.length > 0 && <div><button type="button" className="gal-btn btn-sm" onClick={() => { setDrops([]); setPending({}); setReplay((n) => n + 1); }}>🔁 Revoir l'animation des étoiles (aperçu du coach)</button></div>}
      {here.length === 0 ? <p className="m-0 rounded-2xl bg-white/10 p-3">Ton coach va bientôt te donner tes missions du trimestre.</p> : (
        <ol className="m-0 grid list-none gap-3 p-0">
          {here.map((g) => {
            const m = MISSION[g.axis], target = g.targetStars ?? 10, earned = Math.max(0, missionStars(stars ?? [], g.id, currentSeason(), t) - (pending[g.id] ?? 0)), pct = missionPercent(earned, target), band = bandOf(pct);
            return (
              <li key={g.id} ref={(el) => { rows.current[g.id] = el; }} className={"grid gap-2 rounded-2xl bg-white/10 p-4 " + (flash === g.id ? "bar-pop" : "")}>
                <span className="flex flex-wrap items-center justify-between gap-2"><strong className="text-lg leading-snug">{m.emoji} {g.title}</strong><span className="text-sm font-bold">⭐ {earned} sur {target}</span></span>
                <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.title} : ${earned} étoiles sur ${target}`} className="h-5 overflow-hidden rounded-full bg-black/25">
                  <div className="h-full rounded-full transition-[width,background-color] duration-700" style={{ width: `${Math.max(pct, 4)}%`, background: band.color }} />
                </div>
                <small className="font-bold text-white">{pct >= 100 ? "Bravo, tu as toutes les étoiles !" : band.word}</small>
              </li>
            );
          })}
        </ol>
      )}
      {drops.map((d) => (
        <span key={d.key} aria-hidden="true" className="star-drop pointer-events-none absolute left-0 top-0 z-10 text-3xl" style={{ ["--x" as string]: `${d.x}px`, ["--dy" as string]: `${d.dy}px`, animationDelay: `${d.delay}ms` }} onAnimationEnd={() => landed(d.goalId, d.key)}>⭐</span>
      ))}
    </section>
  );
}

// Onglet « Progrès » : les missions une à une, puis le point de départ (fixe) à côté du radar des étoiles, puis le détail des étoiles
function ProgressTab({ p, stars, goals, preview }: { p: Player; stars: CourseStar[] | null; goals: Goal[]; preview: boolean }) {
  const { evals } = useFollowUp(p.id);
  const bilan = evals?.find((e) => e.season === currentSeason() && e.trimester === 0 && ratedCount(e) > 0);
  const start = bilan ? Object.fromEntries(EVAL_AXES.map((a) => [a.key, axisAverage(bilan, a)])) : undefined;
  return <><MissionProgress goals={goals} stars={stars} playerId={p.id} preview={preview} /><StarsRadar stars={stars} dark start={start} hideDomains /></>;
}

// Onglet « Matchs » : ceux que le jeune déclare + ceux que son coach a enregistrés
function MatchesTab({ p, preview }: { p: Player; preview: boolean }) {
  const { matches } = useFollowUp(p.id);
  return (
    <>
      {!preview && <FamilyTournaments dark />}
      <DeclaredMatchesSection p={p} preview={preview} />
      {matches.length > 0 && (
        <section className="glass gal-pop grid gap-3" aria-labelledby="gal-matchs">
          <h2 id="gal-matchs" className="m-0 text-2xl">📋 Matchs enregistrés par ton coach</h2>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {matches.map((m) => (
              <li key={m.id} className="grid gap-0.5 rounded-2xl bg-white/10 p-3">
                <span className="flex items-center justify-between gap-2"><strong>{m.tournament}{m.round && ` · ${m.round}`}</strong><span className={"gal-chip " + (m.result === "Victoire" ? "!bg-[#dcf247] !text-ink" : "")}>{m.result === "Victoire" ? "🏆 Victoire" : "😕 Défaite"}</span></span>
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

// Onglet « Mes bulletins » : tout au même endroit — mon propre bulletin à remplir + les bulletins de mon coach (bilan de départ + trimestres)
function BulletinsTab({ p, goals, base, selfEvals, pending, preview, onSaved }: { p: Player; goals: Goal[]; base: string; selfEvals: SelfEvaluation[]; pending: number | null; preview: boolean; onSaved: () => void }) {
  const { evals } = useFollowUp(p.id);
  return (
    <>
      <section className="glass gal-pop grid gap-4" aria-labelledby="gal-bulletins">
        <h2 id="gal-bulletins" className="m-0 text-2xl">📄 Mes bulletins</h2>
        <p className="m-0 text-lg text-white/90">Ici, tu retrouves <strong>2 choses</strong> :</p>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          <li className="grid gap-1 rounded-2xl border border-white/25 bg-white/10 p-4"><strong className="text-xl">📄 Les bulletins de mon coach</strong><span>Son bilan de début d'année et son bulletin de chaque trimestre. Tu peux les relire quand tu veux.</span></li>
          <li className="grid gap-1 rounded-2xl border-2 border-[#dcf247] bg-white/10 p-4"><strong className="text-xl">✍️ Mon bulletin à moi</strong><span>Trois fois dans l'année, <strong>c'est toi qui remplis ton propre bulletin</strong> : avec des boutons à toucher, tu dis comment s'est passé ton trimestre.</span></li>
        </ul>
        <p className="m-0 rounded-xl bg-white/10 p-3"><strong>💡 Pourquoi remplir mon bulletin ?</strong> Pour réfléchir à mon jeu : ce dont je suis fier, ce que je veux améliorer, ce que j'aimerais faire. Ton coach le lit et ça l'aide à mieux t'aider. <strong>Il n'y a pas de mauvaise réponse</strong>, et ça ne change pas ta note. Compte 10 minutes ; tu peux enregistrer un brouillon et finir plus tard.</p>
        {!preview && (pending !== null
          ? <p role="status" className="m-0 rounded-xl bg-[#dcf247] p-3 text-lg font-bold text-ink">✨ C'est le moment : ton bulletin du trimestre {pending} t'attend en bas : clique sur « ✍️ Mon bulletin à remplir » pour l'ouvrir !</p>
          : <p className="m-0 text-white/85">🗓️ Ton bulletin s'ouvre le <strong>1er décembre</strong> (trimestre 1), le <strong>1er mars</strong> (trimestre 2) et le <strong>1er juin</strong> (trimestre 3).</p>)}
      </section>
      <section className="glass gal-pop grid gap-4" aria-labelledby="gal-bulletins-coach">
        <h2 id="gal-bulletins-coach" className="m-0 text-2xl">📄 Les bulletins de mon coach</h2>
        {!evals ? <div className="skeleton h-24" role="status" aria-label="Chargement en cours" /> : <BulletinShelf evals={evals} goals={goals} base={base} dark selfEvals={preview ? [] : selfEvals} onSelf={preview ? undefined : () => undefined} />}
      </section>
      <SelfEvalSection p={p} goals={goals} preview={preview} onSaved={onSaved} />
    </>
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

type Tab = "accueil" | "missions" | "videos" | "matchs" | "progres" | "bulletins" | "compte";

// Carte cliquable de l'accueil (« à faire » ou « nouveau »)
// Petite tuile de l'accueil du jeune : une image, un titre court, une ligne. Rien d'autre, pour que ce soit simple à lire.
function Tile({ icon, title, line, onClick, hot = false }: { icon: string; title: string; line: string; onClick: () => void; hot?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={"lift relative grid content-start justify-items-center gap-1 rounded-3xl border-2 p-4 text-center text-white backdrop-blur-md transition-colors " + (hot ? "border-[#dcf247] bg-[#dcf247]/20" : "border-white/20 bg-white/10 hover:bg-white/15")}>
      {hot && <span aria-hidden="true" className="absolute right-3 top-3 h-3.5 w-3.5 rounded-full bg-[#dcf247] shadow-[0_0_0_4px_rgba(220,242,71,0.3)]" />}
      <span className="text-5xl" aria-hidden="true">{icon}</span>
      <strong className="text-lg leading-tight">{title}</strong>
      <span className={"text-sm " + (hot ? "font-bold text-[#dcf247]" : "text-white/85")}>{line}</span>
    </button>
  );
}

function HomeTab({ p, goals, done, wins, fresh, sent, pending, stars, go, base }: { base: string; p: Player; goals: Goal[]; done: number; wins: number; fresh: number; sent: number; pending: number | null; stars: CourseStar[]; go: (t: Tab) => void }) {
  const t = trimesterOf();
  const here = goals.filter((g) => goalApplies(g, t));
  const achieved = here.filter((g) => statusAt(g, t) === "ACHIEVED").length;
  const evaluated = here.some((g) => statusAt(g, t)); // le coach fait le point à la fin du trimestre
  return (
    <>
      <Hero p={p} done={done} wins={wins} starsTotal={totalStars(stars)} />
      <StartBilan p={p} base={base} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Pour toi aujourd'hui">
        <Tile icon="⭐" title="Mes étoiles" line={stars.length ? `${totalStars(stars)} en tout` : "Bientôt !"} onClick={() => go("progres")} />
        <Tile icon="🚀" title="Mes missions" line={here.length ? (evaluated ? `${achieved} réussie${achieved > 1 ? "s" : ""} sur ${here.length}` : `${here.length} à travailler`) : "Bientôt !"} onClick={() => go("missions")} />
        <Tile icon={sent > 0 ? "🎓" : "🎬"} title="Mes vidéos" line={sent > 0 ? "Une vidéo de ton coach !" : fresh > 0 ? "Une analyse t'attend !" : "Envoie-en une"} hot={fresh + sent > 0} onClick={() => go("videos")} />
        <Tile icon={pending !== null ? "✍️" : "📝"} title="Mon bulletin" line={pending !== null ? "À remplir !" : "Bientôt"} hot={pending !== null} onClick={() => go("bulletins")} />
      </section>
    </>
  );
}

const TABS: [Tab, string, string][] = [["accueil", "🏠", "Accueil"], ["missions", "🚀", "Missions"], ["videos", "🎬", "Vidéos"], ["matchs", "🏟️", "Matchs"], ["progres", "📡", "Progrès"], ["bulletins", "📄", "Mes bulletins"], ["compte", "🔒", "Compte"]];

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
  useYouthTheme(isTeen(p)); // thème « ados » à partir de 11 ans (d'après la date de naissance)
  const tab: Tab = (TABS.find(([k]) => k === (params.get("onglet") === "bulletin" ? "bulletins" : params.get("onglet")))?.[0]) ?? "accueil";
  const go = (t: Tab) => { setParams(t === "accueil" ? {} : { onglet: t }, { replace: false }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const stars = useStars(p?.id, version);
  const mine = (videos ?? []).filter((v) => p && v.player?.id === p.id);
  const fresh = mine.filter((v) => (v.analysis?.sentAt || v.fromCoach) && !v.seenAt); // nouvelle analyse ou nouvelle vidéo du coach
  const freshSent = fresh.filter((v) => v.fromCoach && !v.analysis?.sentAt).length;
  const pending = pendingSelfEval(selfEvals, currentSeason());
  const dot = (k: Tab) => (k === "videos" && fresh.length > 0) || (k === "bulletins" && !previewId && pending !== null);

  return (
    <div className="relative isolate overflow-clip">
      <Stars />
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-6">
        {previewId && (
          <p className="glass m-0 flex flex-wrap items-center justify-between gap-2 !p-3 text-sm" role="note">
            <span>👀 <strong>Aperçu coach</strong> : c'est exactement ce que voit {p?.firstName ?? "le jeune"} (sans pouvoir envoyer de vidéo).</span>
            <Link to={`/coach/centre/${previewId}`} className="gal-btn btn-sm no-underline">← Retour au dossier</Link>
          </p>
        )}
        {players === null && <p className="text-center text-white/80">Chargement de ta galaxie…</p>}
        {players?.length === 0 && <div className="glass text-center"><p className="m-0 text-lg">Ton coach n'a pas encore ouvert ton espace. Reviens bientôt !</p></div>}
        {p && (
          <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:items-stretch md:gap-6">
            <nav className="gal-tabs side" aria-label="Mon espace">
              <div role="tablist">
                {TABS.filter(([k]) => k !== "compte" || !previewId).map(([k, icon, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={(e) => { go(k); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} className={"relative min-h-11 whitespace-nowrap rounded-full border-2 px-4 font-bold transition-colors " + (tab === k ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/30 bg-white/10 text-white hover:bg-white/20")}>
                    <span aria-hidden="true">{icon} </span>{label}
                    {dot(k) && tab !== k && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#4338ca] bg-[#ff5d8f]" aria-label="Nouveau" />}
                  </button>
                ))}
              </div>
            </nav>

            <div key={tab} className="gal-pop grid grid-cols-[minmax(0,1fr)] gap-5" role="tabpanel">
              {tab === "accueil" && <HomeTab p={p} goals={goals[p.id] ?? []} done={(goals[p.id] ?? []).filter((g) => g.checkpoints?.some((c) => c.status === "ACHIEVED")).length} wins={wins[p.id] ?? 0} fresh={fresh.length - freshSent} sent={freshSent} pending={pending} stars={stars ?? []} go={go} base={previewId ? `/coach/centre/${p.id}` : `/suivi/${p.id}`} />}
              {tab === "missions" && <><Missions goals={goals[p.id] ?? []} p={p} base={previewId ? `/coach/centre/${p.id}` : `/suivi/${p.id}`} stars={stars} /></>}
              {tab === "videos" && (previewId ? <PreviewVideos mine={mine} /> : <Videos p={p} mine={mine} fresh={fresh} refresh={refresh} />)}
              {tab === "progres" && <ProgressTab p={p} stars={stars} goals={goals[p.id] ?? []} preview={!!previewId} />}
              {tab === "matchs" && <MatchesTab p={p} preview={!!previewId} />}
              {tab === "bulletins" && <BulletinsTab p={p} goals={goals[p.id] ?? []} base={previewId ? `/coach/centre/${p.id}` : `/suivi/${p.id}`} selfEvals={selfEvals} pending={pending} preview={!!previewId} onSaved={refresh} />}
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
          </div>
        )}
      </div>
    </div>
  );
}
