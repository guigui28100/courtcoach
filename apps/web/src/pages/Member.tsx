import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get, post, del } from "../api";
import { useAuth } from "../auth";
import { Radar } from "../components/Radar";
import { MatchTable, SkillBars, useFollowUp } from "../components/Suivi";
import { axisAverage, AXES, currentSeason, EVAL_AXES, fmtAvg, fmtDate, fullName, Goal, goalApplies, isCarriedOver, Lesson, overallAverage, periodLabel, Player, previousPeriod, ratedCount, STATUS as GOAL_STATUS, statusAt, trendCommon, trimesterOf, VideoRow } from "../types";
import { BulletinShelf } from "../components/BulletinShelf";
import { StarsCard, StarsRadar, useStars } from "../components/Stars";
import { Avatar, Empty, Err, Field, Page, PageHead, ProgressBar } from "../components/ui";
import { useVideos, VideoList, VideosIntro, VideoUpload } from "../components/Videos";

const TYPES: Record<string, string> = { individuel: "Cours individuel", duo: "Cours à deux", video: "Reprise d'une analyse vidéo" };
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const STATUS = { PENDING: ["En attente", "!border-[#c08a00] !text-[#7a5a00] !bg-[#fff3cd]"], ACCEPTED: ["Acceptée", "!border-ok !text-ok !bg-[#e6f5ec]"], REFUSED: ["Refusée", "!border-bad !text-bad !bg-[#fdf0ee]"] } as const;

// Vidéos de l'adhérent adulte : il envoie, le coach analyse, ils discutent.
function MyVideos() {
  const [version, setVersion] = useState(0);
  const videos = useVideos(version);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  const fresh = (videos ?? []).filter((v) => v.analysis?.sentAt && !v.seenAt);
  return (
    <section aria-labelledby="t-vid" className="card grid gap-3">
      <h2 id="t-vid" className="m-0">Mes vidéos</h2>
      {fresh.length > 0 && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">✅ Le coach a analysé {fresh.length > 1 ? `${fresh.length} de tes vidéos` : "une de tes vidéos"} : ouvre-la ci-dessous.</p>}
      <p className="m-0 text-muted">Envoie une vidéo de quelques coups : le coach l'analyse et te répond ici.</p>
      <VideoUpload onDone={refresh} />
      <VideoList videos={videos ?? []} onChanged={refresh} empty="Tu n'as pas encore envoyé de vidéo." />
    </section>
  );
}

// Espace de l'adhérent adulte : demandes de cours et réponse du coach, visibles tout de suite.
export function AdultSpace() {
  const { me, eraseAccount } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => { get<Lesson[]>("/lessons").then(setLessons); }, []);
  useEffect(load, [load]);
  const fresh = lessons.filter((l) => l.status !== "PENDING" && !l.seenByMemberAt);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try { await post("/lessons", { type: f.get("type"), objective: String(f.get("objective")), days: f.getAll("days"), moment: f.get("moment"), message: String(f.get("message") || "") || undefined }); setOpen(false); load(); } catch (x) { setErr((x as Error).message); }
  }
  async function exportData() {
    const data = await get("/auth/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "mes-donnees-courtcoach.json" });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      <PageHead eyebrow="Mon espace" title={me?.firstName ? `Bonjour ${me.firstName} !` : "Bienvenue sur CourtCoach !"}>Demande un cours à ton coach et retrouve ici ses réponses.</PageHead>
      <Page>
        {fresh.length > 0 && (
          <div className="grid gap-2" role="status" aria-live="polite">
            {fresh.map((l) => (
              <div key={l.id} className={"flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 " + (l.status === "ACCEPTED" ? "border-ok bg-[#eef8f1]" : "border-bad bg-[#fdf0ee]")}>
                <div>
                  <strong>{l.status === "ACCEPTED" ? "✅ Ton coach a accepté ta demande de cours" : "❌ Ton coach ne peut pas donner suite à ta demande"}</strong>
                  <p className="m-0">{TYPES[l.type]} · {l.objective}{l.coachReply && ` — « ${l.coachReply} »`}</p>
                </div>
                <button className="btn-outline btn-sm" onClick={async () => { await post(`/lessons/${l.id}/seen`); load(); }}>J'ai vu</button>
              </div>
            ))}
          </div>
        )}

        {lessons.length > 0 && (
          <section aria-labelledby="t-dem" className="grid gap-3">
            <h2 id="t-dem" className="m-0">Mes demandes de cours</h2>
            <ul className="m-0 grid list-none gap-3 p-0">
              {lessons.map((l) => (
                <li key={l.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{TYPES[l.type]} · {l.objective}</strong>
                    <p className="m-0 text-sm text-muted">{(l.days.length ? l.days.join(", ") : "Jours à définir") + " · " + l.moment} — demandé le {fmtDate(l.createdAt)}</p>
                    {l.coachReply && <p className="m-0 text-sm font-bold">💬 Réponse du coach : « {l.coachReply} »</p>}
                  </div>
                  <span className={"badge " + STATUS[l.status][1]}>{STATUS[l.status][0]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card grid gap-3">
          <h2 className="m-0">Demander un cours particulier</h2>
          <p className="m-0 text-muted">Tu veux travailler avec ton coach en direct ? Envoie ta demande en quelques secondes.</p>
          <button className="btn-clay self-start" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Masquer le formulaire" : "Demander un cours"}</button>
          {open && (
            <form onSubmit={send} className="grid gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type de cours" id="type"><select id="type" name="type" className="input">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Sur quoi veux-tu travailler ?" id="objective"><select id="objective" name="objective" className="input">{["Coup droit", "Revers", "Service", "Retour de service", "Volée", "Smash", "Jeu de jambes", "Autre"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              </div>
              <fieldset className="field"><legend>Jours qui t'arrangent</legend>
                <div className="flex flex-wrap gap-2">{DAYS.map((d) => <label key={d} className="flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-white px-4 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]"><input type="checkbox" name="days" value={d} className="accent-clay" />{d.slice(0, 3)}.</label>)}</div>
              </fieldset>
              <Field label="Moment de la journée" id="moment"><select id="moment" name="moment" className="input">{["Peu importe", "Matin", "Après-midi", "Soirée"].map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Un message pour ton coach (facultatif)" id="message"><textarea id="message" name="message" className="input" maxLength={500} /></Field>
              <Err msg={err} />
              <button className="btn-clay self-start">Envoyer ma demande</button>
            </form>
          )}
        </section>

        <MyVideos />

        <section className="card grid gap-3 border-dashed">
          <h2 className="m-0 text-lg">Mes données</h2>
          <p className="hint m-0">Tu peux récupérer ou effacer tes données quand tu veux. <Link to="/confidentialite" className="font-bold text-clay underline">Politique de confidentialité</Link></p>
          <div className="flex flex-wrap gap-2">
            <Link to="/mot-de-passe" className="btn-outline btn-sm no-underline">Changer mon mot de passe</Link>
            <button className="btn-outline btn-sm" onClick={exportData}>Télécharger mes données</button>
            <button className="btn-danger btn-sm" onClick={async () => { if (confirm("Supprimer définitivement ton compte et tes données ?")) { await eraseAccount(); window.location.href = "/"; } }}>Supprimer mon compte</button>
          </div>
        </section>
      </Page>
    </>
  );
}

// Objectifs du trimestre : « À travailler » tant que le coach n'a pas fait le point (le statut n'apparaît qu'après son évaluation)
function GoalsTab({ goals }: { goals: Goal[] }) {
  const t = trimesterOf();
  const here = goals.filter((g) => goalApplies(g, t));
  if (!here.length) return <Empty>Aucun objectif fixé pour le trimestre {t} pour l'instant.</Empty>;
  const evaluated = here.some((g) => statusAt(g, t));
  return (
    <div className="grid gap-4">
      <p className="m-0 text-muted">{evaluated ? `Objectifs du trimestre ${t} et bilan du coach.` : `Objectifs à travailler au trimestre ${t}. Le coach fera le point à la fin du trimestre.`}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {AXES.map((a) => {
          const mine = here.filter((g) => g.axis === a.key);
          if (!mine.length) return null;
          return (
            <section key={a.key} className="card grid content-start gap-3 border-t-[6px]" style={{ borderTopColor: a.color }} aria-label={a.label}>
              <h3 className="m-0" style={{ color: a.color }}>{a.label}</h3>
              {mine.map((g) => { const st = statusAt(g, t); return (
                <div key={g.id} className="grid gap-1">
                  <div className="flex flex-wrap items-start justify-between gap-2"><strong>{g.title}</strong>
                    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold" style={st ? { background: GOAL_STATUS[st].bg, color: GOAL_STATUS[st].ink } : { background: "#f1ece4", color: "#4b5566" }}>{st ? `${GOAL_STATUS[st].emoji} ${GOAL_STATUS[st].label}` : "🎯 À travailler"}</span></div>
                  {isCarriedOver(g, t) && <small className="font-bold text-[#5b21b6]">🔁 Objectif reconduit depuis le trimestre {t - 1}</small>}
                  {g.indicator && <small className="hint">Mesuré par : {g.indicator}</small>}
                  {(st || g.progress > 0) && <><ProgressBar value={g.progress} color={a.color} /><small className="font-bold">{g.progress} %</small></>}
                </div>
              ); })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Dernière évaluation et bulletins d'un joueur (lecture seule)
function EvalTab({ p, goals = [] }: { p: Player; goals?: Goal[] }) {
  const { evals } = useFollowUp(p.id);
  if (!evals) return <div className="skeleton h-40" role="status" aria-label="Chargement en cours" />;
  const last = evals.find((e) => ratedCount(e) > 0);
  const prevP = last ? previousPeriod(last.season, last.trimester) : null;
  const prev = last && prevP ? evals.find((e) => e.season === prevP.season && e.trimester === prevP.t) : undefined;
  const now: Record<string, number> = {}, before: Record<string, number> = {};
  EVAL_AXES.forEach((a) => { now[a.key] = axisAverage(last, a); before[a.key] = axisAverage(prev, a); });
  return (
    <div className="card grid gap-4">
      <h3 className="m-0">{last ? (last.trimester === 0 ? "Bilan de début d'année" : "Dernière évaluation") : "Évaluation"}</h3>
      {!last ? <p className="m-0 text-muted">Pas encore d'évaluation trimestrielle.</p> : (
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <div className="grid content-start justify-items-center gap-1">
            <Radar series={[{ label: last.trimester === 0 ? "Départ" : `T${last.trimester}`, values: now, color: "#b8471f" }, ...(prev && prevP ? [{ label: prevP.t === 0 ? "Départ" : `T${prevP.t}`, values: before, color: "#10203a", dashed: true }] : [])]} />
            <p className="m-0 text-center font-bold">{periodLabel(last.season, last.trimester)}<br />Moyenne {fmtAvg(overallAverage(last))} / 5 {trendCommon(last, prev)}</p>
          </div>
          <div className="grid content-start gap-3">
            {last.appreciation && <p className="m-0 rounded-xl bg-sand p-3">« {last.appreciation} »<small className="hint block">Appréciation du coach</small></p>}
            {EVAL_AXES.map((a) => ratedCount({ ratings: Object.fromEntries(a.skills.filter(([k]) => last.ratings[k]).map(([k]) => [k, last.ratings[k]])) }) ? (
              <div key={a.key} className="grid gap-2 border-l-4 pl-3" style={{ borderLeftColor: a.color }}>
                <h4 className="m-0 font-display font-bold" style={{ color: a.color }}>{a.label} · {fmtAvg(axisAverage(last, a))} / 5</h4>
                <SkillBars axis={a} ev={last} prev={prev} />
              </div>
            ) : null)}
            {last.strengths && <p className="m-0"><strong>Points forts : </strong>{last.strengths}</p>}
            {last.improve && <p className="m-0"><strong>À travailler : </strong>{last.improve}</p>}
            {last.next && <p className="m-0"><strong>Objectifs du trimestre suivant : </strong>{last.next}</p>}
          </div>
        </div>
      )}
      {(evals.length > 0 || goals.length > 0) && <><h3 className="m-0">Bulletins</h3><BulletinShelf evals={evals} goals={goals} base={`/suivi/${p.id}`} famille /></>}
    </div>
  );
}

function MatchesTab({ p }: { p: Player }) {
  const { matches } = useFollowUp(p.id);
  return matches.length ? <div className="card grid gap-3"><h3 className="m-0">Compétition</h3><MatchTable matches={matches} /></div> : <Empty>Aucun match enregistré pour l'instant.</Empty>;
}

// Vidéos d'un joueur du Centre : la famille peut en envoyer (si l'accord « droit à l'image » est enregistré) et lire les analyses.
function PlayerVideos({ p, mine, fresh, refresh }: { p: Player; mine: VideoRow[]; fresh: VideoRow[]; refresh: () => void }) {
  return (
    <div className="card grid gap-3">
      <h3 className="m-0">Vidéos</h3>
      <VideosIntro who="famille" />
      {fresh.some((v) => v.fromCoach && !v.analysis?.sentAt) && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">🎓 Le coach a envoyé {fresh.filter((v) => v.fromCoach && !v.analysis?.sentAt).length > 1 ? "des vidéos" : "une vidéo"} : ouvre-{fresh.filter((v) => v.fromCoach && !v.analysis?.sentAt).length > 1 ? "les" : "la"} ci-dessous.</p>}
      {fresh.some((v) => !!v.analysis?.sentAt) && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">✅ Le coach a analysé {fresh.filter((v) => !!v.analysis?.sentAt).length > 1 ? `${fresh.filter((v) => !!v.analysis?.sentAt).length} vidéos` : "une vidéo"} : ouvre-la ci-dessous.</p>}
      <VideoUpload playerId={p.id} onDone={refresh} />
      <VideoList videos={mine} onChanged={refresh} empty="Aucune vidéo pour l'instant." />
    </div>
  );
}

type FTab = "accueil" | "objectifs" | "evaluations" | "etoiles" | "matchs" | "videos" | "compte";
const FTABS: [FTab, string][] = [["accueil", "🏠 Accueil"], ["objectifs", "🎯 Objectifs"], ["evaluations", "📊 Évaluations"], ["etoiles", "⭐ Étoiles"], ["matchs", "🏟️ Matchs"], ["videos", "🎬 Vidéos"], ["compte", "🔒 Compte"]];

// Carte cliquable de l'accueil
function Shortcut({ icon, title, text, hot = false, onClick }: { icon: string; title: string; text: string; hot?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={"card lift grid content-start gap-1 text-left " + (hot ? "!border-ok !bg-[#eef8f1]" : "")}>
      <span className="text-3xl" aria-hidden="true">{icon}</span><strong className="text-lg">{title}</strong><span className="text-sm text-muted">{text}</span><span className="mt-1 text-sm font-bold text-clay">Ouvrir →</span>
    </button>
  );
}

// Espace des parents : suivi du joueur en lecture seule, un sujet par onglet.
export function FamilySpace() {
  const { me, eraseAccount } = useAuth();
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  const [chosen, setChosen] = useState(0); // un parent peut suivre plusieurs enfants
  const [version, setVersion] = useState(0);
  const videos = useVideos(version);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => {
    get<Player[]>("/players").then(async (ps) => {
      setPlayers(ps);
      const entries = await Promise.all(ps.map(async (p) => [p.id, await get<Goal[]>(`/players/${p.id}/goals?season=${currentSeason()}`).catch(() => [] as Goal[])] as const));
      setGoals(Object.fromEntries(entries));
    }).catch(() => setPlayers([]));
  }, []);

  const p = players?.[Math.min(chosen, (players?.length ?? 1) - 1)];
  const tab: FTab = FTABS.find(([k]) => k === params.get("onglet"))?.[0] ?? "accueil";
  const go = (t: FTab) => { setParams(t === "accueil" ? {} : { onglet: t }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const mine = (videos ?? []).filter((v) => p && v.player?.id === p.id);
  const fresh = mine.filter((v) => (v.analysis?.sentAt || v.fromCoach) && !v.seenAt);
  const list = p ? goals[p.id] ?? [] : [];
  const t = trimesterOf();
  const here = list.filter((g) => goalApplies(g, t));
  const achieved = here.filter((g) => statusAt(g, t) === "ACHIEVED").length;
  const evaluated = here.some((g) => statusAt(g, t));
  const stars = useStars(p?.id, version);
  const { evals } = useFollowUp(p?.id ?? "");
  const word = evals?.find((e) => e.appreciation)?.appreciation;

  return (
    <>
      <PageHead eyebrow="Mon suivi" title={me?.firstName ? `Bonjour ${me.firstName}` : "Mon suivi"}>Objectifs, évaluations, matchs et vidéos, en lecture seule.</PageHead>
      <Page>
        {players === null && <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />}
        {players && !players.length && <Empty>Ton coach n'a pas encore ouvert de suivi.</Empty>}
        {p && (
          <>
            {players!.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Choisir l'enfant">
                {players!.map((x, i) => <button key={x.id} onClick={() => setChosen(i)} aria-pressed={i === chosen} className={"flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4 font-bold " + (i === chosen ? "border-ink bg-ink text-white" : "border-line bg-white")}><Avatar name={fullName(x)} size={34} />{x.firstName}</button>)}
              </div>
            )}
            <div className="tabbar">
              <div role="tablist" aria-label="Sections du suivi">
                {FTABS.map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={(e) => { go(k); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} className={"relative min-h-12 whitespace-nowrap border-b-4 px-4 font-bold transition-colors " + (tab === k ? "border-clay text-clay" : "border-transparent text-muted hover:text-ink")}>
                    {label}{k === "videos" && fresh.length > 0 && tab !== k && <span className="absolute right-1 top-2 h-3 w-3 rounded-full bg-clay" aria-label="Nouveau" />}
                  </button>
                ))}
              </div>
            </div>

            <div key={tab + p.id} role="tabpanel" className="page-in grid grid-cols-[minmax(0,1fr)] gap-4">
              {tab === "accueil" && (
                <>
                  <section className="card flex items-center gap-4" aria-label={`Suivi de ${p.firstName}`}>
                    <Avatar name={fullName(p)} size={64} />
                    <div className="min-w-0"><h2 className="m-0">{fullName(p)}</h2><p className="m-0 text-muted">{[p.ranking && `Classement ${p.ranking}`, p.targetRanking && `objectif ${p.targetRanking}`].filter(Boolean).join(" · ") || "Suivi de la saison"}</p></div>
                  </section>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fresh.length > 0 && <Shortcut hot icon="🎬" title={fresh.every((v) => v.fromCoach) ? `Le coach a envoyé ${fresh.length > 1 ? `${fresh.length} vidéos` : "une vidéo"}` : `Du nouveau dans les vidéos (${fresh.length})`} text="Regarder la vidéo du coach, lire ses conseils et les images annotées." onClick={() => go("videos")} />}
                    <Shortcut icon="🎯" title={here.length ? (evaluated ? `${achieved} objectif${achieved > 1 ? "s" : ""} atteint${achieved > 1 ? "s" : ""} sur ${here.length}` : `${here.length} objectif${here.length > 1 ? "s" : ""} à travailler`) : "Objectifs"} text={here.length ? (evaluated ? `Bilan du trimestre ${t}` : `Trimestre ${t} : le coach fera le point à la fin.`) : "Le coach n'a pas encore fixé d'objectifs pour ce trimestre."} onClick={() => go("objectifs")} />
                    <Shortcut icon="📊" title="Évaluations et bulletins" text={word ? `« ${word.length > 110 ? word.slice(0, 107) + "…" : word} »` : "Radar des compétences, bulletins à imprimer."} onClick={() => go("evaluations")} />
                    <Shortcut icon="⭐" title={stars && stars.length ? `${stars.reduce((n, s) => n + s.stars, 0)} étoile${stars.reduce((n, s) => n + s.stars, 0) > 1 ? "s" : ""}` : "Étoiles de fin de cours"} text={stars && stars.length ? `Dernier cours : +${stars[0].stars} ⭐` : "Le coach en donne à la fin des cours, pour l'effort et l'attitude."} onClick={() => go("etoiles")} />
                    <Shortcut icon="🏟️" title="Matchs" text="Résultats des compétitions." onClick={() => go("matchs")} />
                    {!fresh.length && <Shortcut icon="🎬" title="Vidéos" text="Envoyer une vidéo ou lire une analyse." onClick={() => go("videos")} />}
                  </div>
                </>
              )}
              {tab === "objectifs" && <GoalsTab goals={list} />}
              {tab === "evaluations" && <EvalTab p={p} goals={list} />}
              {tab === "etoiles" && <><StarsRadar stars={stars} who="famille" /><StarsCard stars={stars} who="famille" /></>}
              {tab === "matchs" && <MatchesTab p={p} />}
              {tab === "videos" && <PlayerVideos p={p} mine={mine} fresh={fresh} refresh={refresh} />}
              {tab === "compte" && (
                <section className="card grid gap-3">
                  <h2 className="m-0 text-lg">Mes données</h2>
                  <p className="hint m-0">{me?.email} · <Link to="/confidentialite" className="font-bold text-clay underline">Politique de confidentialité</Link> · Pour demander une copie ou la suppression du dossier de l'enfant, écris au club.</p>
                  <Link to="/mot-de-passe" className="btn-outline btn-sm self-start no-underline">Changer mon mot de passe</Link>
                  <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer définitivement ton compte (le dossier du joueur reste au club) ?")) { await eraseAccount(); window.location.href = "/"; } }}>Supprimer mon compte</button>
                </section>
              )}
            </div>
          </>
        )}
      </Page>
    </>
  );
}
