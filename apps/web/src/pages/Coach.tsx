import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { get, patch, post, put } from "../api";
import { useAuth } from "../auth";
import { Avatar, CoachHero, Empty, Err, Field, HeroChip, hueOf, Page, TabsBar } from "../components/ui";
import { useVideos } from "../components/Videos";
import { currentSeason, fmtDate, fmtMo, fullName, Lesson, Player, SelfEvaluation, trimesterOf, VideoRow } from "../types";

const TYPES: Record<string, string> = { individuel: "Cours individuel", duo: "Cours à deux", video: "Reprise d'une analyse vidéo" };

function LessonRow({ l, onDone }: { l: Lesson; onDone: () => void }) {
  const [ask, setAsk] = useState<"ACCEPTED" | "REFUSED" | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  async function send() {
    try { await post(`/lessons/${l.id}/answer`, { status: ask, reply: reply || undefined }); onDone(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <li className="card flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <strong>{l.member?.firstName || l.member?.email} — {TYPES[l.type] ?? "Cours"} · {l.objective}</strong>
        <p className="m-0 text-sm text-muted">📅 {(l.days.length ? l.days.join(", ") : "Jours à définir") + " · " + l.moment}</p>
        {l.message && <p className="m-0 text-sm text-muted">« {l.message} »</p>}
      </div>
      {l.status === "PENDING" ? (
        ask ? (
          <div className="flex w-full flex-wrap gap-2">
            <input className="input min-w-52 flex-1" maxLength={200} aria-label="Message pour l'adhérent (facultatif)" placeholder={ask === "ACCEPTED" ? "Ex. : Samedi 10h, court 2" : "Ex. : Pas de créneau cette semaine"} value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
            <button className={ask === "ACCEPTED" ? "btn-clay btn-sm" : "btn-danger btn-sm"} onClick={send}>{ask === "ACCEPTED" ? "Confirmer l'acceptation" : "Confirmer le refus"}</button>
            <button className="btn-outline btn-sm" onClick={() => setAsk(null)}>Annuler</button>
            <Err msg={err} />
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-clay btn-sm" onClick={() => setAsk("ACCEPTED")}>Accepter</button>
            <button className="btn-danger btn-sm" onClick={() => setAsk("REFUSED")}>Refuser</button>
          </div>
        )
      ) : (
        <span className={"badge " + (l.status === "ACCEPTED" ? "!border-ok !text-ok" : "!border-bad !text-bad")}>{l.status === "ACCEPTED" ? "Acceptée" : "Refusée"}</span>
      )}
    </li>
  );
}

// Liste de vidéos : à analyser, ou déjà analysées (un seul titre, jamais répété)
function VideoQueue({ videos, label, mode }: { videos: VideoRow[]; label: (v: VideoRow) => string; mode: "todo" | "done" }) {
  const list = mode === "todo" ? videos.filter((v) => !v.analysis?.sentAt && !v.fromCoach) : videos.filter((v) => v.analysis?.sentAt);
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {list.map((v) => (
        <li key={v.id}><Link to={`/coach/videos/${v.id}`} className="card flex flex-wrap items-center justify-between gap-2 no-underline hover:shadow-md"><span><strong>{v.title}</strong><small className="hint block">{label(v)} · {v.shot} · {fmtDate(v.recordedAt)}{v.question ? " · avec une question" : ""}</small></span><span className="btn-clay btn-sm">{v.analysis?.sentAt ? "Ouvrir" : v.analysis ? "Terminer l'analyse" : "Analyser"}</span></Link></li>
      ))}
      {!list.length && <li><Empty>{mode === "todo" ? "Aucune vidéo à analyser 🎾" : "Aucune vidéo analysée pour l'instant."}</Empty></li>}
    </ul>
  );
}

const waitingOf = (videos: VideoRow[]) => videos.filter((v) => !v.analysis?.sentAt && !v.fromCoach);

// Onglet choisi, gardé dans l'adresse (?onglet=…) : le bouton « retour » et l'actualisation fonctionnent
function useTab<T extends string>(keys: readonly T[]): [T, (k: T) => void] {
  const [params, setParams] = useSearchParams();
  const tab = (keys.find((k) => k === params.get("onglet")) ?? keys[0]) as T;
  return [tab, (k: T) => setParams(k === keys[0] ? {} : { onglet: k })];
}

// Toutes les données de l'accueil, chargées une seule fois
function useCoachData(version = 0) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [inactive, setInactive] = useState<{ id: string; firstName: string; lastName: string; lastActivityAt: string }[]>([]);
  const [selfEvals, setSelfEvals] = useState<{ player: Player; ev: SelfEvaluation }[]>([]);
  const [storage, setStorage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const videos = useVideos(version);
  const load = useCallback(() => {
    get<Lesson[]>("/lessons").then(setLessons).catch(() => undefined);
    get<Player[]>("/players").then(async (ps) => {
      setPlayers(ps);
      const all = await Promise.all(ps.map(async (p) => (await get<SelfEvaluation[]>(`/players/${p.id}/self-evaluations`).catch(() => [])).filter((e) => !e.readAt).map((ev) => ({ player: p, ev }))));
      setSelfEvals(all.flat());
    }).catch(() => undefined);
    get<typeof inactive>("/players/inactive").then(setInactive).catch(() => undefined);
    get<{ usedBytes: number; quotaBytes: number }>("/videos/storage").then(setStorage).catch(() => undefined);
  }, []);
  useEffect(load, [load, version]);
  const pending = lessons.filter((l) => l.status === "PENDING");
  const adultVideos = (videos ?? []).filter((v) => v.kind === "coaching");
  const youthVideos = (videos ?? []).filter((v) => v.kind === "centre");
  return { lessons, pending, players, inactive, selfEvals, storage, videos, adultVideos, youthVideos, reload: load };
}

// ───────── ACCUEIL : ce qui demande l'attention, une seule fois, puis deux portes d'entrée ─────────
export function CoachHome() {
  const { me } = useAuth();
  const d = useCoachData();
  const adultWait = waitingOf(d.adultVideos), youthWait = waitingOf(d.youthVideos);
  type Todo = { space: "Adultes" | "Jeunes" | "Compte"; text: string; to: string; cta: string };
  const todos: Todo[] = [
    ...d.pending.map((l) => ({ space: "Adultes" as const, text: `${l.member?.firstName || l.member?.email || "Un adhérent"} te demande un cours`, to: "/coach/adultes", cta: "Répondre" })),
    ...adultWait.map((v) => ({ space: "Adultes" as const, text: `${v.owner?.firstName || v.owner?.email || "Un adhérent"} a envoyé une vidéo : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Analyser" })),
    ...youthWait.map((v) => ({ space: "Jeunes" as const, text: `${v.player?.firstName ?? "Un joueur"} a envoyé une vidéo : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Analyser" })),
    ...d.selfEvals.map((x) => ({ space: "Jeunes" as const, text: `${x.player.firstName} a envoyé son bulletin du trimestre ${x.ev.trimester}`, to: `/coach/centre/${x.player.id}?onglet=evaluations`, cta: "Lire" })),
    ...(d.inactive.length ? [{ space: "Jeunes" as const, text: `${d.inactive.length} dossier${d.inactive.length > 1 ? "s" : ""} inactif${d.inactive.length > 1 ? "s" : ""} depuis plus de 12 mois`, to: "/coach/centre?onglet=dossiers", cta: "Voir" }] : []),
    ...(!me?.twoFactor ? [{ space: "Compte" as const, text: "Active la double authentification (2 minutes) avant d'enregistrer de vrais jeunes", to: "/coach/securite", cta: "Activer" }] : []),
    ...(d.storage && d.storage.usedBytes / d.storage.quotaBytes > 0.8 ? [{ space: "Compte" as const, text: "L'espace de stockage des vidéos est presque plein", to: "/coach/securite", cta: "Voir" }] : []),
  ];
  const tag = { Adultes: "bg-[#dbe9fb] text-[#1c4f8a]", Jeunes: "bg-[#fde3d6] text-[#93371a]", Compte: "bg-[#e8edf6] text-ink" };
  const h = new Date().getHours();
  return (
    <>
      <CoachHero
        eyebrow={`Espace coach · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
        title={`${h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"} coach !`}
        subtitle={todos.length === 0 ? "Rien d'urgent : tout est à jour. Belle séance !" : `${todos.length} chose${todos.length > 1 ? "s" : ""} à regarder aujourd'hui.`}
      />
      <Page>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="grid content-between gap-4 rounded-3xl p-6" style={{ background: "linear-gradient(135deg,#dbe9fb,#a9c8f2)" }} aria-labelledby="t-adultes">
            <div className="grid gap-1"><p className="m-0 text-xs font-black uppercase tracking-[0.14em] text-[#1c4f8a]">Espace 1</p><h2 id="t-adultes" className="m-0">👥 Adultes · demandes de coaching</h2><p className="m-0 text-[#243b5c]">Cours particuliers et vidéos des adhérents adultes.</p></div>
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1"><span><strong className="text-2xl">{d.pending.length}</strong> demande{d.pending.length > 1 ? "s" : ""}</span><span><strong className="text-2xl">{adultWait.length}</strong> vidéo{adultWait.length > 1 ? "s" : ""} à analyser</span></p>
            <div><Link to="/coach/adultes" className="btn-clay no-underline">Ouvrir l'espace Adultes</Link></div>
          </section>
          <section className="grid content-between gap-4 rounded-3xl p-6" style={{ background: "linear-gradient(135deg,#fde3d6,#f6b79a)" }} aria-labelledby="t-jeunes">
            <div className="grid gap-1"><p className="m-0 text-xs font-black uppercase tracking-[0.14em] text-[#93371a]">Espace 2</p><h2 id="t-jeunes" className="m-0">🏆 Jeunes · Centre de compétition</h2><p className="m-0 text-[#6a2c14]">Dossiers, objectifs, bulletins, vidéos et étoiles.</p></div>
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1"><span><strong className="text-2xl">{d.players.length}</strong> jeune{d.players.length > 1 ? "s" : ""}</span><span><strong className="text-2xl">{youthWait.length}</strong> vidéo{youthWait.length > 1 ? "s" : ""} à analyser</span></p>
            <div className="flex flex-wrap gap-2"><Link to="/coach/centre" className="btn-clay no-underline">Ouvrir le Centre</Link><Link to="/coach/centre/fin-de-cours" className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">⭐ Fin de cours</Link></div>
          </section>
        </div>

        <details className="card group" open>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"><h2 className="m-0 text-lg uppercase tracking-wide text-muted">À faire aujourd'hui{todos.length > 0 && <span className="ml-2 rounded-full bg-clay px-2.5 py-0.5 text-sm font-black normal-case text-white">{todos.length}</span>}</h2><span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-180">▾</span></summary>
          {todos.length === 0 ? <Empty>Tout est à jour 🎾</Empty> : (
            <ul className="m-0 list-none p-0">
              {todos.slice(0, 8).map((t, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <span className={"rounded-full px-3 py-0.5 text-xs font-black " + tag[t.space]}>{t.space}</span>
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <Link to={t.to} className="font-bold text-clay no-underline hover:underline">{t.cta} →</Link>
                </li>
              ))}
            </ul>
          )}
          {todos.length > 8 && <p className="hint m-0 pt-2">… et {todos.length - 8} autre{todos.length - 8 > 1 ? "s" : ""} dans les espaces Adultes et Jeunes.</p>}
        </details>
      </Page>
    </>
  );
}

// ───────── ESPACE ADULTES : demandes de cours et vidéos des adhérents adultes ─────────
export function AdultsPage() {
  const d = useCoachData();
  const [tab, setTab] = useTab(["demandes", "videos", "historique"] as const);
  const done = d.lessons.filter((l) => l.status !== "PENDING");
  const waiting = waitingOf(d.adultVideos);
  const answered = d.adultVideos.filter((v) => v.analysis?.sentAt);
  const owner = (v: VideoRow) => v.owner?.firstName || v.owner?.email || "Adhérent";
  return (
    <>
      <CoachHero tone="adultes" eyebrow="Espace adultes" title="👥 Demandes de coaching" subtitle="Les adhérents adultes qui te contactent : cours particuliers et vidéos à analyser. Cet espace est totalement séparé des jeunes du Centre." />
      <Page>
        <TabsBar label="Sections de l'espace adultes" active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[["demandes", "📨 Demandes de cours", d.pending.length], ["videos", "🎬 Vidéos à analyser", waiting.length], ["historique", "🗂️ Historique"]]} />
        {tab === "demandes" && (
          <ul className="m-0 grid list-none gap-3 p-0">
            {d.pending.map((l) => <LessonRow key={l.id} l={l} onDone={d.reload} />)}
            {!d.pending.length && <li><Empty>Aucune demande de cours en attente 🎾</Empty></li>}
          </ul>
        )}
        {tab === "videos" && <VideoQueue videos={d.adultVideos} label={owner} mode="todo" />}
        {tab === "historique" && (
          <div className="grid gap-4">
            <section className="grid gap-2"><h2 className="m-0 text-lg">Demandes traitées ({done.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{done.map((l) => <LessonRow key={l.id} l={l} onDone={d.reload} />)}{!done.length && <li><Empty>Rien pour l'instant.</Empty></li>}</ul></section>
            <section className="grid gap-2"><h2 className="m-0 text-lg">Vidéos déjà analysées ({answered.length})</h2><VideoQueue videos={d.adultVideos} label={owner} mode="done" /></section>
          </div>
        )}
      </Page>
    </>
  );
}

// Crée un joueur FICTIF pour découvrir l'espace du jeune, sans rien saisir.
// « debut » : début de saison (bilan de départ + objectifs à travailler, rien d'évalué) ; « fin » : fin de trimestre (objectifs évalués, bulletin, matchs).
async function createExample(stage: "debut" | "fin" = "debut"): Promise<string> {
  const p = await post<Player>("/players", { firstName: "Léo", lastName: "Exemple", birthDate: "2014-03-14" });
  const season = currentSeason(), t = trimesterOf();
  await patch(`/players/${p.id}`, { ranking: "30/2", targetRanking: "30/1", hand: "Droitier", playStyle: "Joueur offensif" });
  // Bilan de début d'année (point de départ), puis le bulletin du trimestre en cours
  await put(`/players/${p.id}/evaluations/${season}/0`, { ratings: { coup_droit: 3, revers: 2, service: 2, retour: 2, volee: 2, deplacements: 3, lecture: 2, construction: 2, endurance: 3, concentration: 2, assiduite: 4, etat_esprit: 4 }, appreciation: "Un joueur plein d'énergie, avec de bonnes bases au coup droit.", strengths: "Coup droit, endurance, bonne humeur.", improve: "Revers, service, régularité sous pression.", next: "Fiabiliser la première balle, gagner en profondeur au coup droit." });
  if (stage === "fin") await put(`/players/${p.id}/evaluations/${season}/${t}`, { ratings: { coup_droit: 4, revers: 3, service: 4, retour: 3, volee: 3, deplacements: 3, lecture: 3, construction: 3, endurance: 4, concentration: 3, assiduite: 5, etat_esprit: 5 }, appreciation: "Tu progresses vite, bravo ! Continue comme ça.", strengths: "Un service qui devient une vraie arme.", improve: "Rester calme après une faute.", next: "Gagner un match en tournoi." });
  // Objectifs du trimestre en cours (avec leur bilan en fin de trimestre : de quoi essayer « Préparer le trimestre suivant »)
  for (const [axis, title, progress, status, indicator, comment] of [
    ["TECHNIQUE", "Fiabiliser la première balle", 100, "ACHIEVED", "60 % de premières balles en match", "Objectif atteint, bravo !"],
    ["TECHNIQUE", "Coup droit plus profond", 55, "IN_PROGRESS", "", "Ça avance bien, on continue."],
    ["TACTIQUE", "Varier les hauteurs et les effets", 30, "NOT_ACHIEVED", "Au moins 3 variations par match", "Pas encore assez travaillé : à reconduire."],
    ["PHYSIQUE", "Améliorer l'endurance", 70, "IN_PROGRESS", "", "Bonne progression."],
    ["MENTAL", "Routine entre les points", 15, "NOT_ACHIEVED", "Routine respectée 8 points sur 10", "À reprendre au prochain trimestre."],
  ] as const) {
    const g = await post<{ id: string }>(`/players/${p.id}/goals`, { season, axis, title, progress: 0, indicator, trimesters: [t] });
    if (stage === "fin") await put(`/goals/${g.id}/checkpoints/${t}`, { progress, status, comment }); // en début de saison, rien n'est encore évalué
  }
  if (stage === "debut") return p.id;
  const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  await post(`/players/${p.id}/matches`, { date: day(20), tournament: "Tournoi du club", round: "Demi-finale", result: "Victoire", score: "6/3 6/4" });
  await post(`/players/${p.id}/matches`, { date: day(6), tournament: "Plateau de Dreux", result: "Défaite", score: "4/6 6/7", remark: "Très serré !" });
  return p.id;
}


// ───────── ESPACE JEUNES : le Centre de compétition ─────────
export function Centre() {
  const nav = useNavigate();
  const d = useCoachData();
  const [tab, setTab] = useTab(["joueurs", "videos", "bulletins", "dossiers"] as const);
  const players = d.players, inactive = d.inactive;
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busyExample, setBusyExample] = useState(false);
  const youthWait = waitingOf(d.youthVideos);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try {
      const p = await post<Player>("/players", { firstName: String(f.get("firstName")), lastName: String(f.get("lastName") || ""), birthDate: f.get("birthDate") || undefined });
      nav(`/coach/centre/${p.id}`);
    } catch (e2) { setErr((e2 as Error).message); }
  }

  return (
    <>
      <CoachHero
        tone="jeunes"
        eyebrow="Espace jeunes · Centre de compétition"
        title="🏆 Mes jeunes compétiteurs"
        subtitle="Profil, objectifs de l'année, accords des parents et accès des familles."
        actions={<><Link to="/coach/centre/fin-de-cours" className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">⭐ Fin de cours</Link><button className="btn border-2 border-white/70 text-white hover:bg-white hover:text-ink" aria-expanded={open} onClick={() => { setTab("joueurs"); setOpen(!open); }}>+ Ajouter un joueur</button></>}
      />
      <Page>
        <p className="alert m-0"><strong>Données de mineurs.</strong> Avant de filmer ou de suivre un jeune, enregistre l'accord écrit de son responsable légal dans sa fiche (onglet « Accords »).</p>
        <TabsBar label="Sections du Centre" active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[["joueurs", "🏆 Mes joueurs", players.length], ["videos", "🎬 Vidéos à analyser", youthWait.length], ["bulletins", "✍️ Bulletins reçus", d.selfEvals.length], ["dossiers", "🗓️ Dossiers à vérifier", inactive.length]]} />

        {tab === "joueurs" && (
          <>
        {open && (
          <form onSubmit={add} className="card grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Prénom" id="p-first"><input id="p-first" name="firstName" required maxLength={60} className="input" autoFocus /></Field>
            <Field label="Nom" id="p-last"><input id="p-last" name="lastName" maxLength={60} className="input" /></Field>
            <Field label="Date de naissance" id="p-birth"><input id="p-birth" name="birthDate" type="date" className="input" /></Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <button className="btn-clay">Créer la fiche</button>
              <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Annuler</button>
            </div>
            <div className="sm:col-span-2"><Err msg={err} /></div>
          </form>
        )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <div key={p.id} className="card lift grid content-between gap-4 overflow-hidden !p-0">
              <div className="h-16" style={{ background: `linear-gradient(120deg, ${hueOf(fullName(p))}, #10203a)` }} aria-hidden="true" />
              <Link to={`/coach/centre/${p.id}`} className="-mt-12 flex items-end gap-3 px-5 no-underline">
                <span className="rounded-full ring-4 ring-white"><Avatar name={fullName(p)} size={64} /></span>
                <span className="min-w-0 pb-1">
                  <h3 className="m-0 truncate">{fullName(p)}</h3>
                </span>
              </Link>
              <div className="flex flex-wrap gap-1.5 px-5">
                {p.ranking ? <span className="badge">🎾 {p.ranking}{p.targetRanking ? ` → ${p.targetRanking}` : ""}</span> : <span className="badge text-muted">Fiche à compléter</span>}
                {p.hand && <span className="badge">{p.hand}</span>}
              </div>
              <div className="flex flex-wrap gap-2 px-5 pb-5">
                <Link to={`/coach/centre/${p.id}`} className="btn-outline btn-sm no-underline">Ouvrir le dossier</Link>
                <Link to={`/coach/centre/${p.id}/apercu`} className="btn-ink btn-sm no-underline">👀 Voir comme le jeune</Link>
              </div>
            </div>
          ))}
              {!players.length && <div className="sm:col-span-2 lg:col-span-3"><Empty>Aucun joueur pour l'instant. Ajoute le premier avec le bouton « + Ajouter un joueur » ci-dessus.</Empty></div>}
            </div>
            <details className="card">
              <summary className="cursor-pointer font-bold text-muted">Pour essayer : créer un joueur fictif</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-outline btn-sm" disabled={busyExample} onClick={async () => { setBusyExample(true); setErr(""); try { nav(`/coach/centre/${await createExample()}/apercu`); } catch (x) { setErr((x as Error).message); setBusyExample(false); } }}>{busyExample ? "Création…" : "✨ Créer un joueur d'exemple (début de saison)"}</button>
                <button className="btn-outline btn-sm" disabled={busyExample} onClick={async () => { setBusyExample(true); setErr(""); try { nav(`/coach/centre/${await createExample("fin")}/apercu`); } catch (x) { setErr((x as Error).message); setBusyExample(false); } }}>{busyExample ? "Création…" : "✨ Exemple en fin de trimestre (fictif)"}</button>
              </div>
            </details>
          </>
        )}

        {tab === "videos" && <VideoQueue videos={d.youthVideos} label={(v) => v.player?.firstName ?? "Joueur"} mode="todo" />}

        {tab === "bulletins" && (
          <ul className="m-0 grid list-none gap-2 p-0">
            {d.selfEvals.map((x) => (
              <li key={x.ev.id}><Link to={`/coach/centre/${x.player.id}?onglet=evaluations`} className="card flex flex-wrap items-center justify-between gap-2 no-underline hover:shadow-md"><span><strong>{x.player.firstName} {x.player.lastName}</strong><small className="hint block">Auto-évaluation du trimestre {x.ev.trimester} · saison {x.ev.season.replace("-", "/")} · envoyée le {fmtDate(x.ev.sentAt ?? x.ev.updatedAt)}</small></span><span className="btn-clay btn-sm">Lire</span></Link></li>
            ))}
            {!d.selfEvals.length && <li><Empty>Aucun nouveau bulletin d'auto-évaluation à lire ✍️</Empty></li>}
          </ul>
        )}

        {tab === "dossiers" && (
          <section className="card grid gap-2">
            <h2 className="m-0 text-lg">Dossiers inactifs depuis plus de 12 mois</h2>
            <p className="hint m-0">Les données d'un jeune qui a quitté le club ne doivent pas être gardées : télécharge une copie si besoin, puis supprime.</p>
            {inactive.map((p) => <Link key={p.id} to={`/coach/centre/${p.id}`} className="font-bold text-clay underline">{fullName(p)} — dernière activité le {fmtDate(p.lastActivityAt)}</Link>)}
            {!inactive.length && <Empty>Aucun dossier à vérifier : tout est récent 👍</Empty>}
          </section>
        )}
        <Err msg={err} />
      </Page>
    </>
  );
}
