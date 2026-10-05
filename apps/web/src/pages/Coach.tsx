import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, patch, post, put } from "../api";
import { useAuth } from "../auth";
import { Avatar, CoachHero, Empty, Err, Field, HeroChip, hueOf, Page, ShortcutTile } from "../components/ui";
import { useVideos } from "../components/Videos";
import { currentSeason, fmtDate, fmtMo, fullName, Lesson, Player, trimesterOf, VideoRow } from "../types";

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

function WaitingVideos({ videos, label }: { videos: VideoRow[]; label: (v: VideoRow) => string }) {
  const waiting = videos.filter((v) => !v.analysis?.sentAt && !v.fromCoach); // une vidéo que le coach a envoyée n'a rien à analyser
  const answered = videos.filter((v) => v.analysis?.sentAt);
  const row = (v: VideoRow) => (
    <li key={v.id}><Link to={`/coach/videos/${v.id}`} className="card flex flex-wrap items-center justify-between gap-2 no-underline hover:shadow-md"><span><strong>{v.title}</strong><small className="hint block">{label(v)} · {v.shot} · {fmtDate(v.recordedAt)}{v.question ? " · avec une question" : ""}</small></span><span className="btn-clay btn-sm">{v.analysis?.sentAt ? "Ouvrir" : v.analysis ? "Terminer l'analyse" : "Analyser"}</span></Link></li>
  );
  return (
    <div className="grid gap-2">
      <h3 className="m-0">Vidéos à analyser ({waiting.length})</h3>
      <ul className="m-0 grid list-none gap-2 p-0">{waiting.map(row)}{!waiting.length && <li className="hint">Aucune vidéo en attente.</li>}</ul>
      {answered.length > 0 && <details><summary className="cursor-pointer font-bold text-muted">Déjà analysées ({answered.length})</summary><ul className="mt-2 grid list-none gap-2 p-0">{answered.map(row)}</ul></details>}
    </div>
  );
}

export function CoachHome() {
  const { me } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [version, setVersion] = useState(0);
  const videos = useVideos(version);
  const [storage, setStorage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const load = useCallback(() => { get<Lesson[]>("/lessons").then(setLessons); get<Player[]>("/players").then(setPlayers); get<{ usedBytes: number; quotaBytes: number }>("/videos/storage").then(setStorage).catch(() => undefined); setVersion((n) => n + 1); }, []);
  useEffect(load, [load]);
  const pending = lessons.filter((l) => l.status === "PENDING");
  const done = lessons.filter((l) => l.status !== "PENDING");
  const waiting = (videos ?? []).filter((v) => !v.analysis?.sentAt && !v.fromCoach).length;
  const toDo = pending.length + waiting;

  return (
    <>
      <CoachHero
        eyebrow={`Espace coach · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
        title={`${new Date().getHours() < 12 ? "Bonjour" : new Date().getHours() < 18 ? "Bon après-midi" : "Bonsoir"} coach !`}
        subtitle={toDo === 0 ? "Rien d'urgent : tout est à jour. Belle séance !" : `Il y a ${toDo} chose${toDo > 1 ? "s" : ""} à regarder aujourd'hui.`}
        chips={<><HeroChip>📨 {pending.length} demande{pending.length > 1 ? "s" : ""}</HeroChip><HeroChip>🎬 {waiting} vidéo{waiting > 1 ? "s" : ""} à analyser</HeroChip><HeroChip>🏆 {players.length} jeune{players.length > 1 ? "s" : ""} suivi{players.length > 1 ? "s" : ""}</HeroChip></>}
        actions={<><Link to="/coach/centre/fin-de-cours" className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">⭐ Fin de cours</Link><Link to="/coach/centre" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">🏆 Mes jeunes</Link></>}
      />
      <Page>
        {!me?.twoFactor && <p role="note" className="alert m-0">🔐 <strong>Protège ton compte :</strong> active la <Link to="/coach/securite" className="font-bold underline">double authentification</Link> (2 minutes) avant d'enregistrer de vrais jeunes.</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Raccourcis">
          <ShortcutTile tone="yellow" icon="⭐" title="Fin de cours" text="Donner les étoiles du jour" to="/coach/centre/fin-de-cours" />
          <ShortcutTile tone="clay" icon="🏆" title="Centre jeunes" text="Fiches, objectifs, bulletins" to="/coach/centre" />
          <ShortcutTile tone="blue" icon="📨" title="Demandes" text="Cours et vidéos des adultes" to="#t-coaching" badge={pending.length + (videos ?? []).filter((v) => v.kind === "coaching" && !v.analysis?.sentAt).length} />
          <ShortcutTile tone="ink" icon="🔐" title="Sécurité" text="Double authentification" to="/coach/securite" />
        </div>
        <section className="card grid gap-3" aria-labelledby="t-coaching">
          <h2 id="t-coaching" className="m-0 flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#dbe9fb] text-xl" aria-hidden="true">📨</span>Demandes de coaching</h2>
          <p className="hint m-0">Adhérents adultes qui te contactent : demandes de cours.</p>
          <ul className="m-0 grid list-none gap-3 p-0">
            {pending.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}
            {!pending.length && <li><Empty>Aucune demande de coaching en attente 🎾</Empty></li>}
          </ul>
          <WaitingVideos videos={(videos ?? []).filter((v) => v.kind === "coaching")} label={(v) => v.owner?.firstName || v.owner?.email || "Adhérent"} />
          {done.length > 0 && (
            <details>
              <summary className="cursor-pointer font-bold text-muted">Historique ({done.length})</summary>
              <ul className="mt-3 grid list-none gap-2 p-0">{done.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}</ul>
            </details>
          )}
        </section>

        <section className="card grid gap-3 border-t-[6px] border-t-clay bg-[#fffaf5]" aria-labelledby="t-centre">
          <h2 id="t-centre" className="m-0 flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fde3d6] text-xl" aria-hidden="true">🏆</span>Centre de compétition jeunes</h2>
          <p className="hint m-0">Suivi des jeunes compétiteurs. Séparé des demandes de coaching.</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">{players.slice(0, 8).map((p) => <Link key={p.id} to={`/coach/centre/${p.id}`} title={fullName(p)} className="no-underline"><Avatar name={fullName(p)} size={40} /></Link>)}<strong>{players.length} jeune{players.length > 1 ? "s" : ""} suivi{players.length > 1 ? "s" : ""}</strong></div>
            <Link to="/coach/centre" className="btn-clay btn-sm no-underline">Ouvrir le Centre</Link>
          </div>
          <WaitingVideos videos={(videos ?? []).filter((v) => v.kind === "centre")} label={(v) => v.player?.firstName ?? "Joueur"} />
        </section>
        {storage && (
          <section className="card grid gap-2 border-dashed" aria-label="Espace de stockage des vidéos">
            <h2 className="m-0 flex items-center gap-2 text-lg"><span aria-hidden="true">💾</span>Espace de stockage des vidéos</h2>
            <p className="m-0">{fmtMo(storage.usedBytes)} utilisés sur {fmtMo(storage.quotaBytes)}</p>
            <div className="h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={Math.round((storage.usedBytes / storage.quotaBytes) * 100)} aria-valuemin={0} aria-valuemax={100}><div className={"h-full " + (storage.usedBytes / storage.quotaBytes > 0.8 ? "bg-bad" : "bg-clay")} style={{ width: `${Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100)}%` }} /></div>
            <p className="hint m-0">Les vidéos sont supprimées automatiquement après 12 mois. Supprime celles qui ne servent plus pour garder de la place.</p>
          </section>
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

export function Centre() {
  const nav = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [inactive, setInactive] = useState<{ id: string; firstName: string; lastName: string; lastActivityAt: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busyExample, setBusyExample] = useState(false);
  const load = useCallback(() => { get<Player[]>("/players").then(setPlayers); get("/players/inactive").then(setInactive); }, []);
  useEffect(load, [load]);

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
        eyebrow="Centre de compétition jeunes"
        title="Mes jeunes compétiteurs"
        subtitle="Profil, objectifs de l'année, accords des parents et accès des familles."
        chips={<><HeroChip>🏆 {players.length} joueur{players.length > 1 ? "s" : ""}</HeroChip>{inactive.length > 0 && <HeroChip>🗓️ {inactive.length} dossier{inactive.length > 1 ? "s" : ""} inactif{inactive.length > 1 ? "s" : ""}</HeroChip>}</>}
        actions={<><Link to="/coach/centre/fin-de-cours" className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">⭐ Fin de cours</Link><button className="btn border-2 border-white/70 text-white hover:bg-white hover:text-ink" aria-expanded={open} onClick={() => setOpen(!open)}>+ Ajouter un joueur</button></>}
      />
      <Page>
        <p className="alert m-0"><strong>Données de mineurs.</strong> Avant de filmer ou de suivre un jeune, enregistre l'accord écrit de son responsable légal dans sa fiche (onglet « Accords »).</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0">Mes joueurs</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" disabled={busyExample} onClick={async () => { setBusyExample(true); setErr(""); try { nav(`/coach/centre/${await createExample()}/apercu`); } catch (x) { setErr((x as Error).message); setBusyExample(false); } }}>{busyExample ? "Création…" : "✨ Créer un joueur d'exemple (début de saison)"}</button>
            <button className="btn-outline btn-sm" disabled={busyExample} onClick={async () => { setBusyExample(true); setErr(""); try { nav(`/coach/centre/${await createExample("fin")}/apercu`); } catch (x) { setErr((x as Error).message); setBusyExample(false); } }}>{busyExample ? "Création…" : "✨ Exemple en fin de trimestre (fictif)"}</button>
          </div>
        </div>
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
          {!players.length && <div className="sm:col-span-2 lg:col-span-3"><Empty>Aucun joueur pour l'instant. Ajoute le premier avec le bouton ci-dessus.</Empty></div>}
        </div>
        {inactive.length > 0 && (
          <section className="card grid gap-2">
            <h2 className="m-0">Dossiers inactifs depuis plus de 12 mois</h2>
            <p className="hint m-0">Les données d'un jeune qui a quitté le club ne doivent pas être gardées : télécharge une copie si besoin, puis supprime.</p>
            {inactive.map((p) => <Link key={p.id} to={`/coach/centre/${p.id}`} className="font-bold text-clay underline">{fullName(p)} — dernière activité le {fmtDate(p.lastActivityAt)}</Link>)}
          </section>
        )}
      </Page>
    </>
  );
}
