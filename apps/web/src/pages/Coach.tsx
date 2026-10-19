import { PendingReports } from "../components/TournamentReports";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { get, patch, post, put } from "../api";
import { useAuth } from "../auth";
import { TrainersTab } from "../components/Trainers";
import { ProfsAdmin } from "../components/Profs";
import { TournamentsTab } from "../components/Tournaments";
import { Avatar, CoachHero, Empty, Err, Field, HeroChip, hueOf, Page, SideLayout, TabsBar } from "../components/ui";
import { MarkBadge, useVideos } from "../components/Videos";
import { adultFacts, adultName, collapseSeries, everyDay, fmtDeadline, currentSeason, DEPART_SHOTS, GESTURE_MARKS, fmtDate, fmtSlot, todayIso, fmtMo, fullName, Lesson, Player, profName, SelfEvaluation, TournamentReport, trimesterOf, VideoRow } from "../types";

const TYPES: Record<string, string> = { individuel: "Cours individuel", duo: "Cours à deux", video: "Cours particulier" }; // « video » : anciennes demandes, affichées comme un cours

const FRESH_MS = 3 * 86_400_000; // une confirmation reste signalée « nouvelle » 3 jours

export function LessonRow({ l, onDone, asProf = false }: { l: Lesson; onDone: () => void; asProf?: boolean }) {
  const [ask, setAsk] = useState<"PROPOSED" | "REFUSED" | null>(null);
  const [date, setDate] = useState(l.finalSlot?.date ?? ""), [time, setTime] = useState(l.finalSlot?.time ?? "18:00");
  const [place, setPlace] = useState(l.place ?? ""), [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  const freshConfirm = l.status === "ACCEPTED" && !!l.confirmedAt && Date.now() - new Date(l.confirmedAt).getTime() < FRESH_MS;
  async function send() {
    setErr("");
    if (ask === "PROPOSED" && (!date || !time)) { setErr("Indique la date et l'heure du cours."); return; }
    try { await post(`/lessons/${l.id}/answer`, ask === "PROPOSED" ? { status: "PROPOSED", slot: { date, time }, place: place || undefined, reply: reply || undefined } : { status: "REFUSED", reply: reply || undefined }); setAsk(null); onDone(); } catch (e) { setErr((e as Error).message); }
  }
  async function confirmBooking() { setErr(""); try { await post(`/lessons/${l.id}/confirm`); onDone(); } catch (e) { setErr((e as Error).message); } }
  const serie = (l.seriesCount ?? 0) > 1 && !!l.finalSlot; // série « toute l'année »
  async function stopSeries() {
    if (!confirm("Arrêter toute la série ? Tous les cours à venir sont annulés, les créneaux sont libérés et l'adulte est prévenu.")) return;
    setErr(""); try { await post(`/lessons/${l.id}/stop-series`, {}); onDone(); } catch (e) { setErr((e as Error).message); }
  }
  const field = "input !min-h-11";
  const badge = l.status === "ACCEPTED" ? ["Confirmé par l'adulte", "!border-ok !text-ok"] : l.status === "PROPOSED" ? ["Pas encore confirmé", "!border-[#c08a00] !text-[#7a5a00]"] : l.status === "BOOKED" ? ["À confirmer par le professeur", "!border-[#c08a00] !text-[#7a5a00]"] : l.status === "REFUSED" ? ["Refusé / annulé", "!border-bad !text-bad"] : null;
  return (
    <li className={"card grid gap-3 " + (freshConfirm ? "!border-ok !border-2" : "")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong>{adultName(l.member, "Adhérent")} — {TYPES[l.type] ?? "Cours"} · {l.objective}</strong>
          {serie && <p className="m-0 text-sm font-bold text-clay">🔁 Série « toute l'année » : {everyDay(l.finalSlot!)} · {l.seriesCount} cours {l.status === "BOOKED" ? "à confirmer" : l.status === "REFUSED" ? "annulés" : "à venir"}</p>}
          <p className="m-0 flex flex-wrap gap-x-4 text-sm font-bold text-ink"><span>🙋 {adultFacts(l.member) || <span className="font-normal text-muted">Âge et niveau non renseignés</span>}</span>{l.member?.phone && <a href={`tel:${l.member.phone.replace(/[^0-9+]/g, "")}`} className="text-clay underline">📞 {l.member.phone}</a>}</p>
          {!asProf && l.prof && <p className="m-0 text-sm font-bold text-ink">👩‍🏫 Choisi par l'adulte : {profName(l.prof)}</p>}
          {!!l.price && <p className="m-0 text-sm font-bold text-ink">💶 {l.price} € la séance · {l.memberDeclared ? "adhérent du TC Houdan (déclaré par l'adulte)" : "tarif non-adhérent"}</p>}
          {l.type === "duo" && l.partnerFirstName && <p className="m-0 text-sm font-bold text-ink">👥 Partenaire : {l.partnerFirstName} {l.partnerLastName}{l.partnerAge ? ` · ${l.partnerAge} ans` : ""}{l.partnerLevel ? ` · ${l.partnerLevel}` : ""}</p>}
          <p className="m-0 text-sm text-muted">📅 {(l.days.length ? l.days.join(", ") : "Jours à définir") + " · " + l.moment}</p>
          {l.message && <p className="m-0 text-sm text-muted">« {l.message} »</p>}
        </div>
        {badge && <span className={"badge " + badge[1]}>{badge[0]}</span>}
      </div>

      {l.status === "PENDING" && l.declinedSlot && <p className="m-0 rounded-xl bg-[#fdf0ee] p-3 font-bold text-[#9a2a1f]">⚠ Pas disponible le {fmtSlot(l.declinedSlot)}{l.adultReply ? ` : « ${l.adultReply} »` : ""}. Propose-lui une autre date.</p>}
      {l.status === "PROPOSED" && l.finalSlot && <p className="m-0 rounded-xl bg-[#fff8e1] p-3 font-bold text-[#7a5a00]">⏳ Tu as proposé : {fmtSlot(l.finalSlot)}{l.place ? ` · ${l.place}` : ""}. <u>Ne te déplace pas avant sa confirmation.</u></p>}
      {l.status === "BOOKED" && l.finalSlot && <p className="m-0 rounded-xl bg-[#fff8e1] p-3 font-bold text-[#7a5a00]">🔔 Réservé par l'adulte : {fmtSlot(l.finalSlot)}. {serie ? "Toute la série : " : ""}{asProf ? "À toi de confirmer" : "Le professeur doit confirmer"} avant {fmtDeadline(l.createdAt)} : sans réponse, le créneau est libéré.</p>}
      {l.status === "ACCEPTED" && l.finalSlot && <p className="m-0 rounded-xl bg-[#eef8f1] p-3 font-bold text-[#1d6b43]">{freshConfirm ? "🔔 Nouveau : " : ""}✅ Confirmé{l.confirmedAt ? ` le ${new Date(l.confirmedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""} : {fmtSlot(l.finalSlot)}{l.place ? ` · ${l.place}` : ""}</p>}
      {l.status !== "PENDING" && l.coachReply && <p className="m-0 text-sm text-muted">💬 « {l.coachReply} »</p>}

      {l.status !== "REFUSED" && (!ask ? (
        <div className="flex flex-wrap gap-2">
          {l.status === "BOOKED" && <button className="btn-clay btn-sm !bg-ok" onClick={confirmBooking}>{serie ? "✅ Je confirme toute la série" : "✅ Je confirme ce cours"}</button>}
          {l.status === "PENDING" && <button className="btn-clay btn-sm" onClick={() => setAsk("PROPOSED")}>📅 Proposer une date</button>}
          {l.status !== "PENDING" && l.status !== "BOOKED" && <button className="btn-outline btn-sm" onClick={() => setAsk("PROPOSED")}>✏️ Changer la date</button>}
          <button className="btn-danger btn-sm" onClick={() => setAsk("REFUSED")}>{l.status === "PENDING" ? "Refuser" : l.status === "BOOKED" ? "❌ Je ne peux pas" : serie ? "Libérer ce créneau (un seul cours)" : "Annuler le cours"}</button>
          {serie && l.status !== "BOOKED" && l.status !== "PENDING" && <button className="btn-danger btn-sm" onClick={stopSeries}>⛔ Arrêter la série</button>}
        </div>
      ) : (
        <div className="grid gap-3 rounded-2xl border-2 border-line bg-chalk p-3">
          {ask === "PROPOSED" && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-sm font-bold">Date du cours<input type="date" className={field} min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} autoFocus /></label>
                <label className="grid gap-1 text-sm font-bold">Heure<input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} /></label>
                <label className="grid min-w-44 flex-1 gap-1 text-sm font-bold">Lieu (facultatif)<input className={field} maxLength={60} placeholder="Ex. : court 2" value={place} onChange={(e) => setPlace(e.target.value)} /></label>
              </div>
              <p className="hint m-0">L'adulte devra confirmer cette date avant que le cours soit validé : tu verras ici quand il aura répondu.</p>
            </>
          )}
          <input className={field} maxLength={200} aria-label="Message pour l'adhérent (facultatif)" placeholder={ask === "PROPOSED" ? "Un petit mot pour l'adhérent (facultatif)" : l.status === "PENDING" ? "Ex. : Pas de créneau cette semaine" : "Ex. : Pluie annoncée, on annule"} value={reply} onChange={(e) => setReply(e.target.value)} />
          <Err msg={err} />
          <div className="flex flex-wrap gap-2">
            <button className={ask === "PROPOSED" ? "btn-clay btn-sm" : "btn-danger btn-sm"} onClick={send}>{ask === "PROPOSED" ? "Envoyer la proposition" : l.status === "PENDING" ? "Confirmer le refus" : "Confirmer l'annulation"}</button>
            <button className="btn-outline btn-sm" onClick={() => { setAsk(null); setErr(""); }}>Annuler</button>
          </div>
        </div>
      ))}
    </li>
  );
}

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

// Centre d'analyse vidéo (onglet « Vidéos » du Centre) : ce qu'il y a à analyser, ce qui attend d'être envoyé, et l'avancement des gestes de chaque joueur
function CentreVideos({ videos, players }: { videos: VideoRow[]; players: Player[] }) {
  const [rdv, setRdv] = useState<string>("DEPART");
  const drafts = videos.filter((v) => v.draft);
  const replies = videos.filter((v) => v.awaitingReply);
  const g = GESTURE_MARKS.find((x) => x.key === rdv)!;
  const done = (pid: string, shot: string) => videos.find((v) => v.player?.id === pid && v.shot === shot && v.mark === rdv);
  const filmed = players.reduce((n, p) => n + DEPART_SHOTS.filter((sh) => done(p.id, sh)).length, 0);
  return (
    <div className="grid gap-6">
      {replies.length > 0 && (
        <section className="grid gap-2" aria-label="Messages à lire">
          <h2 className="m-0 text-lg">💬 Nouveaux messages ({replies.length})</h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {replies.map((v) => <li key={v.id}><Link to={`/coach/videos/${v.id}`} className="card flex flex-wrap items-center justify-between gap-2 border-2 border-clay no-underline hover:shadow-md"><span><strong>💬 Nouveau message de {v.player?.firstName ?? "un joueur"}</strong><small className="hint block">{v.title}</small></span><span className="btn-clay btn-sm">Répondre</span></Link></li>)}
          </ul>
        </section>
      )}
      <section className="grid gap-2" aria-label="Vidéos à analyser">
        <h2 className="m-0 text-lg">📥 À analyser</h2>
        <VideoQueue videos={videos} label={(v) => v.player?.firstName ?? "Joueur"} mode="todo" />
      </section>
      {drafts.length > 0 && (
        <section className="grid gap-2" aria-label="Brouillons à envoyer">
          <h2 className="m-0 text-lg">📝 À envoyer ({drafts.length})</h2>
          <p className="hint m-0">Déposées par toi : les joueurs ne les voient pas encore.</p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {drafts.map((v) => <li key={v.id}><Link to={`/coach/videos/${v.id}`} className="card flex flex-wrap items-center justify-between gap-2 no-underline hover:shadow-md"><span><strong>{v.title}</strong><small className="hint block">{v.player?.firstName ?? "Joueur"} · {v.shot} · {fmtDate(v.recordedAt)}</small></span><span className="flex items-center gap-2"><MarkBadge v={v} /><span className="btn-clay btn-sm">Ouvrir et envoyer</span></span></Link></li>)}
          </ul>
        </section>
      )}
      <section className="grid gap-3" aria-label="Gestes des joueurs">
        <div>
          <h2 className="m-0 text-lg">🎬 Gestes des joueurs</h2>
          <p className="hint m-0">Choisis un rendez-vous : ✅ = déjà filmé (touche pour l'ouvrir), ＋ = à filmer (touche pour l'ajouter). {filmed} sur {players.length * DEPART_SHOTS.length}.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rendez-vous">
          {GESTURE_MARKS.map((m) => <button key={m.key} type="button" role="tab" aria-selected={rdv === m.key} onClick={() => setRdv(m.key)} className={"min-h-11 rounded-full border-2 px-4 text-sm font-bold " + (rdv === m.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-sand")}>{m.emoji} {m.key === "DEPART" ? "Départ (septembre)" : `${m.label} (${m.when})`}</button>)}
        </div>
        {players.length === 0 ? <Empty>Aucun joueur pour l'instant.</Empty> : (
          <div className="overflow-x-auto rounded-xl border-2 border-line bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Avancement de « {g.label} » par joueur et par coup</caption>
              <thead><tr className="bg-sand text-left"><th scope="col" className="p-2">Joueur</th>{DEPART_SHOTS.map((sh) => <th key={sh} scope="col" className="p-2 text-center">{sh}</th>)}</tr></thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <th scope="row" className="p-2 text-left"><Link to={`/coach/centre/${p.id}?onglet=videos`} className="font-bold text-ink underline">{p.firstName}</Link></th>
                    {DEPART_SHOTS.map((sh) => { const v = done(p.id, sh); return (
                      <td key={sh} className="p-1 text-center">
                        {v ? <Link to={`/coach/videos/${v.id}`} className="inline-block min-h-9 min-w-9 rounded-lg border border-ok bg-[#eef8f1] px-2 py-1 font-bold text-ok no-underline" aria-label={`${p.firstName} : ${sh}, déjà filmé${v.draft ? " (brouillon)" : ""}`}>{v.draft ? "📝" : "✅"}</Link>
                          : <Link to={`/coach/centre/${p.id}?onglet=videos&coup=${encodeURIComponent(sh)}&rdv=${rdv}`} className="inline-block min-h-9 min-w-9 rounded-lg border border-dashed border-line px-2 py-1 font-bold text-muted no-underline hover:bg-sand" aria-label={`${p.firstName} : ${sh}, à filmer`}>＋</Link>}
                      </td>
                    ); })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
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
  const { viewAs } = useAuth(); // « voir comme un entraîneur » : seulement SES jeunes
  const mine = useCallback(<T,>(l: T[], idOf: (x: T) => string | undefined) => (viewAs ? l.filter((x) => viewAs.playerIds.includes(idOf(x) ?? "")) : l), [viewAs]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [inactive, setInactive] = useState<{ id: string; firstName: string; lastName: string; lastActivityAt: string }[]>([]);
  const [selfEvals, setSelfEvals] = useState<{ player: Player; ev: SelfEvaluation }[]>([]);
  const [storage, setStorage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const videos = useVideos(version);
  const [reports, setReports] = useState<TournamentReport[]>([]);
  const [profsWaiting, setProfsWaiting] = useState(0);
  // UNE seule demande pour tout l'accueil (avant : une dizaine, dont une par jeune)
  const load = useCallback(() => {
    get<{ players: Player[]; lessons: Lesson[]; inactive: typeof inactive; storage: typeof storage; reports: TournamentReport[]; selfEvals: { player: Player; ev: SelfEvaluation }[]; profsWaiting: number }>("/dashboard").then((d) => {
      setPlayers(mine(d.players, (p) => p.id));
      setLessons(d.lessons); setInactive(d.inactive); setStorage(d.storage); setReports(d.reports); setProfsWaiting(d.profsWaiting);
      setSelfEvals(mine(d.selfEvals, (x) => x.player.id));
    }).catch(() => undefined);
  }, [mine]);
  useEffect(load, [load, version]);
  const pending = lessons.filter((l) => l.status === "PENDING");
  const toConfirm = lessons.filter((l) => l.status === "PROPOSED").sort((a, b) => (a.finalSlot!.date + a.finalSlot!.time).localeCompare(b.finalSlot!.date + b.finalSlot!.time));
  const booked = collapseSeries(lessons.filter((l) => l.status === "BOOKED" && l.finalSlot)).sort((a, b) => (a.finalSlot!.date + a.finalSlot!.time).localeCompare(b.finalSlot!.date + b.finalSlot!.time)); // réservés par l'adulte, le professeur doit confirmer
  const upcoming = collapseSeries(lessons.filter((l) => l.status === "ACCEPTED" && l.finalSlot && l.finalSlot.date >= todayIso())).sort((a, b) => (a.finalSlot!.date + a.finalSlot!.time).localeCompare(b.finalSlot!.date + b.finalSlot!.time));
  const adultVideos = (videos ?? []).filter((v) => v.kind === "coaching");
  const youthVideos = mine((videos ?? []).filter((v) => v.kind === "centre"), (v) => (v as { playerId?: string }).playerId);
  return { lessons, pending, toConfirm, booked, upcoming, players, inactive, selfEvals, storage, videos, adultVideos, youthVideos, reports, profsWaiting, reload: load };
}

// ───────── ACCUEIL : ce qui demande l'attention, une seule fois, puis deux portes d'entrée ─────────
export function CoachHome() {
  const { me } = useAuth();
  const d = useCoachData();
  const adultWait = waitingOf(d.adultVideos), youthWait = waitingOf(d.youthVideos);
  type Todo = { space: "Adultes" | "Jeunes" | "Compte"; text: string; to: string; cta: string };
  const todos: Todo[] = [
    ...d.pending.map((l) => ({ space: "Adultes" as const, text: l.declinedSlot ? `${adultName(l.member, "Un adhérent")} n'est pas disponible le ${fmtSlot(l.declinedSlot)} : propose une autre date` : `${adultName(l.member, "Un adhérent")} demande un cours${l.prof ? ` à ${profName(l.prof)}` : ""}`, to: "/coach/adultes", cta: "Répondre" })),
    ...d.upcoming.filter((l) => l.confirmedAt && Date.now() - new Date(l.confirmedAt).getTime() < FRESH_MS).map((l) => ({ space: "Adultes" as const, text: `✅ ${adultName(l.member, "Un adhérent")} a confirmé son cours : ${fmtSlot(l.finalSlot!)}`, to: "/coach/adultes", cta: "Voir" })),
    ...(d.profsWaiting ? [{ space: "Adultes" as const, text: `👩‍🏫 ${d.profsWaiting} professeur${d.profsWaiting > 1 ? "s" : ""} à valider (documents déposés)`, to: "/coach/adultes?onglet=profs", cta: "Vérifier" }] : []),
    ...adultWait.map((v) => ({ space: "Adultes" as const, text: `${adultName(v.owner, "Un adhérent")} a envoyé une vidéo : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Analyser" })),
    ...youthWait.map((v) => ({ space: "Jeunes" as const, text: `${v.player?.firstName ?? "Un joueur"} a envoyé une vidéo : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Analyser" })),
    ...[...d.adultVideos, ...d.youthVideos].filter((v) => v.awaitingReply).map((v) => ({ space: (v.kind === "centre" ? "Jeunes" : "Adultes") as "Jeunes" | "Adultes", text: `💬 Nouveau message de ${v.kind === "centre" ? (v.player?.firstName ?? "un joueur") : adultName(v.owner, "un adhérent")} : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Répondre" })),
    ...(d.youthVideos.some((v) => v.draft) ? [{ space: "Jeunes" as const, text: `📝 ${d.youthVideos.filter((v) => v.draft).length} vidéo${d.youthVideos.filter((v) => v.draft).length > 1 ? "s" : ""} déposée${d.youthVideos.filter((v) => v.draft).length > 1 ? "s" : ""} par toi, pas encore envoyée${d.youthVideos.filter((v) => v.draft).length > 1 ? "s" : ""}`, to: "/coach/centre?onglet=videos", cta: "Voir" }] : []),
    ...(d.reports.length ? [{ space: "Jeunes" as const, text: `🏆 ${d.reports.length} bilan${d.reports.length > 1 ? "s" : ""} de tournoi à valider`, to: "/coach/centre?onglet=bilans", cta: "Valider" }] : []),
    ...d.selfEvals.map((x) => ({ space: "Jeunes" as const, text: `${x.player.firstName} a envoyé son bulletin du trimestre ${x.ev.trimester}`, to: `/coach/centre/${x.player.id}?onglet=evaluations`, cta: "Lire" })),
    ...(d.inactive.length ? [{ space: "Jeunes" as const, text: `${d.inactive.length} dossier${d.inactive.length > 1 ? "s" : ""} inactif${d.inactive.length > 1 ? "s" : ""} depuis plus de 12 mois`, to: "/coach/centre?onglet=dossiers", cta: "Voir" }] : []),
    ...(!me?.twoFactor ? [{ space: "Compte" as const, text: "Active la double authentification (2 minutes) avant d'enregistrer de vrais jeunes", to: "/coach/securite", cta: "Activer" }] : []),
    ...(d.storage && d.storage.usedBytes / d.storage.quotaBytes > 0.8 ? [{ space: "Compte" as const, text: "L'espace de stockage des vidéos est presque plein", to: "/coach/securite", cta: "Voir" }] : []),
  ];
  const tag = { Adultes: "border-l-[#2a6fb0]", Jeunes: "border-l-clay", Compte: "border-l-ink" };
  const icon = { Adultes: "👥", Jeunes: "🏆", Compte: "🔐" };
  const h = new Date().getHours();
  const kpi = (n: number, label: string) => <span className="min-w-28 rounded-2xl bg-white/15 px-4 py-2 text-white"><b className="block font-display text-3xl font-black leading-none">{n}</b><small className="text-white/85">{label}</small></span>;
  const quick: [string, string, string][] = [["⭐", "Donner des étoiles", "/coach/centre/fin-de-cours"], ["📄", "Bulletins", "/coach/centre?onglet=bulletins"], ["🎬", "Vidéos et gestes", "/coach/centre?onglet=videos"], ["🔐", "Sécurité", "/coach/securite"]];
  return (
    <>
      <CoachHero
        eyebrow={`Espace coach · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
        title={`${h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"} coach !`}
        subtitle={todos.length === 0 ? "Rien d'urgent : tout est à jour. Belle séance !" : undefined}
        chips={<>{kpi(todos.length, todos.length > 1 ? "choses à faire" : "chose à faire")}{kpi(d.booked.length + d.toConfirm.length, "cours en attente")}{kpi(adultWait.length + youthWait.length, "vidéos à analyser")}{kpi(d.players.length, "jeunes suivis")}</>}
      />
      <Page>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid content-start gap-6">
            <section aria-labelledby="t-todo" className="grid gap-3">
              <h2 id="t-todo" className="m-0 text-xl">✅ À faire aujourd'hui{todos.length > 0 && <span className="ml-2 rounded-full bg-clay px-2.5 py-0.5 align-middle text-sm font-black text-white">{todos.length}</span>}</h2>
              {todos.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-line bg-white p-6 text-center text-lg">Tout est à jour 🎾</div> : (
                <ul className="m-0 grid list-none gap-2.5 p-0">
                  {todos.slice(0, 8).map((t, i) => (
                    <li key={i} className={"flex flex-wrap items-center gap-3 rounded-2xl border-2 border-l-8 border-line bg-white px-4 py-3 " + tag[t.space]}>
                      <span aria-hidden="true" className="text-2xl">{icon[t.space]}</span>
                      <span className="grid min-w-0 flex-1"><strong className="leading-snug">{t.text}</strong><small className="text-muted">{t.space === "Compte" ? "Mon compte" : t.space === "Adultes" ? "Espace Adultes" : "Espace Jeunes"}</small></span>
                      <Link to={t.to} className="btn-clay btn-sm no-underline">{t.cta} →</Link>
                    </li>
                  ))}
                </ul>
              )}
              {todos.length > 8 && <p className="hint m-0">… et {todos.length - 8} autre{todos.length - 8 > 1 ? "s" : ""} dans les espaces Adultes et Jeunes.</p>}
            </section>
            <section aria-labelledby="t-espaces" className="grid gap-3">
              <h2 id="t-espaces" className="m-0 text-xl">🚪 Mes deux espaces</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-between gap-3 rounded-3xl border-2 border-[#b7cdef] p-5" style={{ background: "linear-gradient(135deg,#dbe9fb,#a9c8f2)" }}>
                  <div className="grid gap-1"><p className="m-0 text-xs font-black uppercase tracking-[0.14em] text-[#1c4f8a]">Espace 1</p><h3 className="m-0 text-xl">👥 Adultes</h3><p className="m-0 text-sm text-[#243b5c]">Cours particuliers, vidéos, professeurs.</p></div>
                  <p className="m-0 text-sm"><strong className="text-lg">{d.pending.length}</strong> demande{d.pending.length > 1 ? "s" : ""} · <strong className="text-lg">{adultWait.length}</strong> vidéo{adultWait.length > 1 ? "s" : ""}</p>
                  <div><Link to="/coach/adultes" className="btn-clay no-underline">Ouvrir →</Link></div>
                </div>
                <div className="grid content-between gap-3 rounded-3xl border-2 border-[#f0b99c] p-5" style={{ background: "linear-gradient(135deg,#fde3d6,#f6b79a)" }}>
                  <div className="grid gap-1"><p className="m-0 text-xs font-black uppercase tracking-[0.14em] text-[#93371a]">Espace 2</p><h3 className="m-0 text-xl">🏆 Jeunes · Centre de compétition</h3><p className="m-0 text-sm text-[#6a2c14]">Dossiers, objectifs, bulletins, étoiles.</p></div>
                  <p className="m-0 text-sm"><strong className="text-lg">{d.players.length}</strong> jeune{d.players.length > 1 ? "s" : ""} · <strong className="text-lg">{youthWait.length}</strong> vidéo{youthWait.length > 1 ? "s" : ""}</p>
                  <div className="flex flex-wrap gap-2"><Link to="/coach/centre" className="btn-clay no-underline">Ouvrir →</Link><Link to="/coach/centre/fin-de-cours" className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">⭐ Fin de cours</Link></div>
                </div>
              </div>
            </section>
          </div>
          <div className="grid content-start gap-6">
            <section aria-labelledby="t-cours" className="grid gap-3">
              <h2 id="t-cours" className="m-0 text-xl">📅 Mes prochains cours</h2>
              {d.upcoming.length === 0 ? <p className="m-0 rounded-2xl border-2 border-dashed border-line bg-white p-4 text-center text-muted">Aucun cours confirmé à venir.</p> : (
                <ul className="m-0 grid list-none gap-2.5 p-0">
                  {d.upcoming.slice(0, 4).map((l) => { const dt = new Date(`${l.finalSlot!.date}T12:00:00`); return (
                    <li key={l.id} className="flex items-center gap-3 rounded-2xl border-2 border-l-8 border-line border-l-ok bg-white px-3 py-2.5">
                      <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink text-center leading-none text-white"><span className="grid"><small className="text-[0.65rem] font-bold uppercase">{dt.toLocaleDateString("fr-FR", { weekday: "short" })}</small><b className="font-display text-2xl">{dt.getDate()}</b></span></span>
                      <span className="grid min-w-0"><strong className="leading-tight">{l.finalSlot!.time.replace(":", " h ").replace(/ h 00$/, " h")} · {adultName(l.member, "Adhérent")}</strong><small className="text-muted">{l.objective}{l.place ? ` · ${l.place}` : ""}{l.prof ? ` · avec ${l.prof.firstName ?? "le professeur"}` : ""}</small></span>
                    </li>
                  ); })}
                </ul>
              )}
              {d.upcoming.length > 4 && <Link to="/coach/adultes" className="font-bold text-clay no-underline hover:underline">Voir tous les cours ({d.upcoming.length}) →</Link>}
            </section>
            <section aria-labelledby="t-raccourcis" className="grid gap-3">
              <h2 id="t-raccourcis" className="m-0 text-xl">⚡ Raccourcis</h2>
              <div className="grid grid-cols-2 gap-3">{quick.map(([ic, label, to]) => <Link key={label} to={to} className="grid justify-items-center gap-1 rounded-2xl border-2 border-line bg-white p-3 text-center font-bold text-ink no-underline hover:border-clay"><span aria-hidden="true" className="text-3xl">{ic}</span>{label}</Link>)}</div>
            </section>
          </div>
        </div>
      </Page>
    </>
  );
}

// ───────── ESPACE ADULTES : demandes de cours et vidéos des adhérents adultes ─────────
export function AdultsPage() {
  const d = useCoachData();
  const [tab, setTab] = useTab(["demandes", "videos", "profs", "historique"] as const);
  const done = d.lessons.filter((l) => l.status === "REFUSED" || (l.status === "ACCEPTED" && !d.upcoming.includes(l)));
  const waiting = waitingOf(d.adultVideos);
  const answered = d.adultVideos.filter((v) => v.analysis?.sentAt);
  const owner = (v: VideoRow) => [adultName(v.owner), adultFacts(v.owner)].filter(Boolean).join(" · ");
  return (
    <>
      <CoachHero tone="adultes" eyebrow="Espace adultes" title="👥 Demandes de coaching" subtitle="Les adhérents adultes qui te contactent : cours particuliers et vidéos à analyser. Cet espace est totalement séparé des jeunes du Centre." actions={<><Link to="/coach/adultes/apercu" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">👀 Voir comme un adulte</Link><Link to="/coach/adultes/apercu-prof" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">👀 Voir comme un professeur</Link></>} />
      <Page>
        <TabsBar side={false} label="Sections de l'espace adultes" active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[["demandes", "📨 Demandes de cours", d.pending.length], ["videos", "🎬 Vidéos à analyser", waiting.length], ["profs", "👩‍🏫 Professeurs", d.profsWaiting], ["historique", "🗂️ Historique"]]} />
        {tab === "demandes" && (
          <div className="grid gap-6">
            <ul className="m-0 grid list-none gap-3 p-0">
              {d.pending.map((l) => <LessonRow key={l.id} l={l} onDone={d.reload} />)}
              {!d.pending.length && <li><Empty>Aucune demande de cours en attente 🎾</Empty></li>}
            </ul>
            {d.toConfirm.length > 0 && <section className="grid gap-2"><h2 className="m-0 text-lg">⏳ En attente de la confirmation de l'adulte ({d.toConfirm.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{d.toConfirm.map((l) => <LessonRow key={l.id} l={l} onDone={d.reload} />)}</ul></section>}
            {d.booked.length > 0 && <section className="grid gap-2"><h2 className="m-0 text-lg">🔔 Réservés, le professeur doit confirmer ({d.booked.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{d.booked.map((l) => <LessonRow key={l.id} l={l} onDone={d.reload} />)}</ul></section>}
            {d.upcoming.length > 0 && <section className="grid gap-2"><h2 className="m-0 text-lg">✅ Prochains cours confirmés ({d.upcoming.length})</h2><ul className="m-0 grid list-none gap-2 p-0">{d.upcoming.map((l) => <LessonRow key={l.id} l={l} onDone={d.reload} />)}</ul></section>}
          </div>
        )}
        {tab === "videos" && <VideoQueue videos={d.adultVideos} label={owner} mode="todo" />}
        {tab === "profs" && <ProfsAdmin onChanged={d.reload} />}
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
  const { me } = useAuth();
  const isCoach = me?.role === "COACH"; // un entraîneur de comité ne voit que les jeunes qui lui sont confiés : pas de création, pas de dossiers inactifs, pas de gestion des comptes
  const d = useCoachData();
  const [tab, setTab] = useTab(["joueurs", "videos", "bulletins", "bilans", "tournois", "dossiers", "entraineurs"] as const);
  const players = d.players, inactive = d.inactive;
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busyExample, setBusyExample] = useState(false);
  const youthWait = waitingOf(d.youthVideos), youthDrafts = d.youthVideos.filter((v) => v.draft).length, youthReplies = d.youthVideos.filter((v) => v.awaitingReply).length;

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
        subtitle={isCoach ? "Profil, objectifs de l'année, accords des parents et accès des familles." : "Les jeunes que le coach te confie : objectifs, missions, bilans, bulletins, étoiles et vidéos."}
        actions={<><Link to="/coach/centre/fin-de-cours" className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">⭐ Fin de cours</Link>{isCoach && <Link to="/coach/centre/apercu-entraineur" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">👀 Voir comme un entraîneur de comité</Link>}{isCoach && <button className="btn border-2 border-white/70 text-white hover:bg-white hover:text-ink" aria-expanded={open} onClick={() => { setTab("joueurs"); setOpen(!open); }}>+ Ajouter un joueur</button>}</>}
      />
      <Page>
        <p className="alert m-0">{isCoach ? <><strong>Données de mineurs.</strong> Avant de filmer ou de suivre un jeune, enregistre l'accord écrit de son responsable légal dans sa fiche (onglet « Accords »).</> : <><strong>Données de mineurs.</strong> Tu ne vois que les jeunes que le coach t'a confiés. Ne partage rien de ce que tu vois en dehors du club.</>}</p>
        <SideLayout nav={<TabsBar label="Sections du Centre" active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[["joueurs", "🏆 Mes joueurs", players.length], ["videos", "🎬 Vidéos et gestes", youthWait.length + youthDrafts + youthReplies], ["bulletins", "✍️ Bulletins reçus", d.selfEvals.length], ...(isCoach ? [["bilans", "🏆 Bilans de tournoi", d.reports.length] as [string, string, number?]] : []), ["tournois", "📅 Tournois"], ...(isCoach ? [["dossiers", "🗓️ Dossiers à vérifier", inactive.length], ["entraineurs", "👥 Entraîneurs"]] as [string, string, number?][] : [])]} />}>

        {tab === "joueurs" && (
          <>
        {isCoach && open && (
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
            <div key={p.id} className="card lift grid min-w-0 content-between gap-4 overflow-hidden !p-0">
              <div className="h-16" style={{ background: `linear-gradient(120deg, ${hueOf(fullName(p))}, #10203a)` }} aria-hidden="true" />
              <Link to={`/coach/centre/${p.id}`} className="-mt-12 flex items-end gap-3 px-5 no-underline">
                <span className="rounded-full ring-4 ring-white"><Avatar name={fullName(p)} size={64} /></span>
                <span className="min-w-0 pb-1">
                  <h3 className="m-0 text-lg leading-tight [overflow-wrap:anywhere]">{fullName(p)}</h3>
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
              {!players.length && <div className="sm:col-span-2 lg:col-span-3"><Empty>{isCoach ? "Aucun joueur pour l'instant. Ajoute le premier avec le bouton « + Ajouter un joueur » ci-dessus." : "Le coach ne t'a pas encore confié de jeune."}</Empty></div>}
            </div>
            {isCoach && <details className="card">
              <summary className="cursor-pointer font-bold text-muted">Pour essayer : créer un joueur fictif</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-outline btn-sm" disabled={busyExample} onClick={async () => { setBusyExample(true); setErr(""); try { nav(`/coach/centre/${await createExample()}/apercu`); } catch (x) { setErr((x as Error).message); setBusyExample(false); } }}>{busyExample ? "Création…" : "✨ Créer un joueur d'exemple (début de saison)"}</button>
                <button className="btn-outline btn-sm" disabled={busyExample} onClick={async () => { setBusyExample(true); setErr(""); try { nav(`/coach/centre/${await createExample("fin")}/apercu`); } catch (x) { setErr((x as Error).message); setBusyExample(false); } }}>{busyExample ? "Création…" : "✨ Exemple en fin de trimestre (fictif)"}</button>
              </div>
            </details>}
          </>
        )}

        {tab === "videos" && <CentreVideos videos={d.youthVideos} players={players} />}

        {tab === "bulletins" && (
          <ul className="m-0 grid list-none gap-2 p-0">
            {d.selfEvals.map((x) => (
              <li key={x.ev.id}><Link to={`/coach/centre/${x.player.id}?onglet=evaluations`} className="card flex flex-wrap items-center justify-between gap-2 no-underline hover:shadow-md"><span><strong>{x.player.firstName} {x.player.lastName}</strong><small className="hint block">Auto-évaluation du trimestre {x.ev.trimester} · saison {x.ev.season.replace("-", "/")} · envoyée le {fmtDate(x.ev.sentAt ?? x.ev.updatedAt)}</small></span><span className="btn-clay btn-sm">Lire</span></Link></li>
            ))}
            {!d.selfEvals.length && <li><Empty>Aucun nouveau bulletin d'auto-évaluation à lire ✍️</Empty></li>}
          </ul>
        )}

        {isCoach && tab === "bilans" && <PendingReports list={d.reports} onChanged={d.reload} />}
        {tab === "tournois" && <TournamentsTab players={players} isCoach={isCoach} />}

        {isCoach && tab === "entraineurs" && <TrainersTab players={players} />}

        {isCoach && tab === "dossiers" && (
          <section className="card grid gap-2">
            <h2 className="m-0 text-lg">Dossiers inactifs depuis plus de 12 mois</h2>
            <p className="hint m-0">Les données d'un jeune qui a quitté le club ne doivent pas être gardées : télécharge une copie si besoin, puis supprime.</p>
            {inactive.map((p) => <Link key={p.id} to={`/coach/centre/${p.id}`} className="font-bold text-clay underline">{fullName(p)} — dernière activité le {fmtDate(p.lastActivityAt)}</Link>)}
            {!inactive.length && <Empty>Aucun dossier à vérifier : tout est récent 👍</Empty>}
          </section>
        )}
        <Err msg={err} />
        </SideLayout>
      </Page>
    </>
  );
}
