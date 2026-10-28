import { HOLIDAYS_WARN_DAYS, holidaysDaysLeft, holidaysLastDay } from "../schoolDays";
import { ClubNotice } from "../components/MyClubEvents";
import { PendingReports } from "../components/TournamentReports";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { get, patch, post, put } from "../api";
import { useAuth } from "../auth";
import { TrainersTab } from "../components/Trainers";
import { ProfsAdmin } from "../components/Profs";
import { TournamentsTab } from "../components/Tournaments";
import { useRegisterSubNav } from "../components/subnav";
import { Avatar, ClubLogo, CoachHero, Empty, Err, Field, HeroChip, hueOf, Page, SideLayout, TabsBar } from "../components/ui";
import { MarkBadge, useVideos } from "../components/Videos";
import { adultFacts, adultName, collapseSeries, everyDay, fmtDeadline, currentSeason, DEPART_SHOTS, GESTURE_MARKS, fmtDate, fmtSlot, todayIso, fmtDay, fmtMo, fullName, Lesson, Player, profName, SelfEvaluation, TournamentReport, trimesterOf, VideoRow } from "../types";

const TYPES: Record<string, string> = { individuel: "Cours individuel", duo: "Cours à deux", video: "Cours particulier" }; // « video » : anciennes demandes, affichées comme un cours

const FRESH_MS = 3 * 86_400_000; // une confirmation reste signalée « nouvelle » 3 jours

export function LessonRow({ l, onDone, asProf = false }: { l: Lesson; onDone: () => void; asProf?: boolean }) {
  const [ask, setAsk] = useState<"REFUSED" | null>(null); // plus de « proposer une date » : l'adulte choisit lui-même son créneau dans le planning
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  const freshConfirm = l.status === "ACCEPTED" && !!l.confirmedAt && Date.now() - new Date(l.confirmedAt).getTime() < FRESH_MS;
  async function send() {
    setErr("");
    try { await post(`/lessons/${l.id}/answer`, { status: "REFUSED", reply: reply || undefined }); setAsk(null); onDone(); } catch (e) { setErr((e as Error).message); }
  }
  async function confirmBooking() { setErr(""); try { await post(`/lessons/${l.id}/confirm`); onDone(); } catch (e) { setErr((e as Error).message); } }
  const serie = (l.seriesCount ?? 0) > 1 && !!l.finalSlot; // série « toute l'année »
  async function stopSeries() {
    if (!confirm("Arrêter toute la série ? Tous les cours à venir sont annulés, les créneaux sont libérés et l'adulte est prévenu.")) return;
    setErr(""); try { await post(`/lessons/${l.id}/stop-series`, {}); onDone(); } catch (e) { setErr((e as Error).message); }
  }
  const field = "input !min-h-11";
  const badge = l.status === "ACCEPTED" ? ["Confirmé", "!border-ok !text-ok"] : l.status === "PROPOSED" ? ["Ancienne demande", "!border-line !text-muted"] : l.status === "BOOKED" ? ["À confirmer par le professeur", "!border-[#c08a00] !text-[#7a5a00]"] : l.status === "REFUSED" ? ["Refusé / annulé", "!border-bad !text-bad"] : null;
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

      {l.status === "BOOKED" && l.finalSlot && <p className="m-0 rounded-xl bg-[#fff8e1] p-3 font-bold text-[#7a5a00]">🔔 Réservé par l'adulte : {fmtSlot(l.finalSlot)}. {serie ? "Toute la série : " : ""}{asProf ? "À toi de confirmer" : "Le professeur doit confirmer"} avant {fmtDeadline(l.createdAt)} : sans réponse, le créneau est libéré.</p>}
      {l.status === "ACCEPTED" && l.finalSlot && <p className="m-0 rounded-xl bg-[#eef8f1] p-3 font-bold text-[#1d6b43]">{freshConfirm ? "🔔 Nouveau : " : ""}✅ Confirmé{l.confirmedAt ? ` le ${new Date(l.confirmedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""} : {fmtSlot(l.finalSlot)}{l.place ? ` · ${l.place}` : ""}</p>}
      {l.status !== "PENDING" && l.coachReply && <p className="m-0 text-sm text-muted">💬 « {l.coachReply} »</p>}

      {l.status !== "REFUSED" && (!ask ? (
        <div className="flex flex-wrap gap-2">
          {l.status === "BOOKED" && <button className="btn-clay btn-sm !bg-ok !text-white" onClick={confirmBooking}>{serie ? "✅ Je confirme toute la série" : "✅ Je confirme ce cours"}</button>}
          <button className="btn-danger btn-sm" onClick={() => setAsk("REFUSED")}>{l.status === "PENDING" ? "Refuser" : l.status === "BOOKED" ? "❌ Je ne peux pas" : serie ? "Libérer ce créneau (un seul cours)" : "Annuler le cours"}</button>
          {serie && l.status !== "BOOKED" && l.status !== "PENDING" && <button className="btn-danger btn-sm" onClick={stopSeries}>⛔ Arrêter la série</button>}
        </div>
      ) : (
        <div className="grid gap-3 rounded-2xl border-2 border-line bg-chalk p-3">
          <input className={field} maxLength={200} aria-label="Message pour l'adhérent (facultatif)" placeholder={l.status === "PENDING" ? "Ex. : Réserve un créneau chez un professeur" : "Ex. : Pluie annoncée, on annule"} value={reply} onChange={(e) => setReply(e.target.value)} />
          <Err msg={err} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-danger btn-sm" onClick={send}>{l.status === "PENDING" ? "Confirmer le refus" : "Confirmer l'annulation"}</button>
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
  const pending = lessons.filter((l) => l.status === "PENDING" || l.status === "PROPOSED"); // anciennes demandes d'avant le planning (on ne peut plus en créer) : à clôturer
  const booked = collapseSeries(lessons.filter((l) => l.status === "BOOKED" && l.finalSlot)).sort((a, b) => (a.finalSlot!.date + a.finalSlot!.time).localeCompare(b.finalSlot!.date + b.finalSlot!.time)); // réservés par l'adulte, le professeur doit confirmer
  const upcoming = collapseSeries(lessons.filter((l) => l.status === "ACCEPTED" && l.finalSlot && l.finalSlot.date >= todayIso())).sort((a, b) => (a.finalSlot!.date + a.finalSlot!.time).localeCompare(b.finalSlot!.date + b.finalSlot!.time));
  const adultVideos = (videos ?? []).filter((v) => v.kind === "coaching");
  const youthVideos = mine((videos ?? []).filter((v) => v.kind === "centre"), (v) => (v as { playerId?: string }).playerId);
  return { lessons, pending, booked, upcoming, players, inactive, selfEvals, storage, videos, adultVideos, youthVideos, reports, profsWaiting, reload: load };
}

// ───────── ACCUEIL : ce qui demande l'attention, une seule fois, puis deux portes d'entrée ─────────
export function CoachHome() {
  const { me } = useAuth();
  const d = useCoachData();
  const adultWait = waitingOf(d.adultVideos), youthWait = waitingOf(d.youthVideos);
  type Todo = { space: "Adultes" | "Jeunes" | "Compte"; text: string; to: string; cta: string };
  const todos: Todo[] = [
    ...d.pending.map((l) => ({ space: "Adultes" as const, text: `Ancienne demande de ${adultName(l.member, "un adhérent")} : à clôturer (les demandes libres n'existent plus)`, to: "/coach/adultes", cta: "Voir" })),
    ...d.upcoming.filter((l) => l.confirmedAt && Date.now() - new Date(l.confirmedAt).getTime() < FRESH_MS).map((l) => ({ space: "Adultes" as const, text: `✅ ${adultName(l.member, "Un adhérent")} cours confirmé : ${fmtSlot(l.finalSlot!)}`, to: "/coach/adultes", cta: "Voir" })),
    ...(d.profsWaiting ? [{ space: "Adultes" as const, text: `👩‍🏫 ${d.profsWaiting} professeur${d.profsWaiting > 1 ? "s" : ""} à valider (documents déposés)`, to: "/coach/adultes?onglet=profs", cta: "Vérifier" }] : []),
    ...adultWait.map((v) => ({ space: "Adultes" as const, text: `${adultName(v.owner, "Un adhérent")} a envoyé une vidéo : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Analyser" })),
    ...youthWait.map((v) => ({ space: "Jeunes" as const, text: `${v.player?.firstName ?? "Un joueur"} a envoyé une vidéo : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Analyser" })),
    ...[...d.adultVideos, ...d.youthVideos].filter((v) => v.awaitingReply).map((v) => ({ space: (v.kind === "centre" ? "Jeunes" : "Adultes") as "Jeunes" | "Adultes", text: `💬 Nouveau message de ${v.kind === "centre" ? (v.player?.firstName ?? "un joueur") : adultName(v.owner, "un adhérent")} : ${v.title}`, to: `/coach/videos/${v.id}`, cta: "Répondre" })),
    ...(d.youthVideos.some((v) => v.draft) ? [{ space: "Jeunes" as const, text: `📝 ${d.youthVideos.filter((v) => v.draft).length} vidéo${d.youthVideos.filter((v) => v.draft).length > 1 ? "s" : ""} déposée${d.youthVideos.filter((v) => v.draft).length > 1 ? "s" : ""} par toi, pas encore envoyée${d.youthVideos.filter((v) => v.draft).length > 1 ? "s" : ""}`, to: "/coach/centre?onglet=videos", cta: "Voir" }] : []),
    ...(d.reports.length ? [{ space: "Jeunes" as const, text: `🏆 ${d.reports.length} bilan${d.reports.length > 1 ? "s" : ""} de tournoi à valider`, to: "/coach/centre?onglet=bilans", cta: "Valider" }] : []),
    ...d.selfEvals.map((x) => ({ space: "Jeunes" as const, text: `${x.player.firstName} a envoyé son bulletin du trimestre ${x.ev.trimester}`, to: `/coach/centre/${x.player.id}?onglet=evaluations`, cta: "Lire" })),
    ...(d.inactive.length ? [{ space: "Jeunes" as const, text: `${d.inactive.length} dossier${d.inactive.length > 1 ? "s" : ""} inactif${d.inactive.length > 1 ? "s" : ""} depuis plus de 12 mois`, to: "/coach/centre?onglet=dossiers", cta: "Voir" }] : []),
    ...(holidaysDaysLeft(todayIso()) < HOLIDAYS_WARN_DAYS ? [{ space: "Compte" as const, text: `Les dates de vacances scolaires s'arrêtent le ${fmtDay(holidaysLastDay())} : ajoute la nouvelle année pour que les cours ne soient pas proposés pendant les vacances`, to: "/coach/securite", cta: "Voir" }] : []),
    ...(!me?.twoFactor ? [{ space: "Compte" as const, text: "Active la double authentification (2 minutes) avant d'enregistrer de vrais jeunes", to: "/coach/securite", cta: "Activer" }] : []),
    ...(d.storage && d.storage.usedBytes / d.storage.quotaBytes > 0.8 ? [{ space: "Compte" as const, text: "L'espace de stockage des vidéos est presque plein", to: "/coach/securite", cta: "Voir" }] : []),
  ];
  const tag = { Adultes: "border-l-[#3f4b5c]", Jeunes: "border-l-clay", Compte: "border-l-ink" };
  const icon = { Adultes: "👥", Jeunes: "🏆", Compte: "🔐" };
  const h = new Date().getHours();
  const first = me?.firstName?.trim() || "coach";
  const today = todayIso();
  const nextToday = d.upcoming.find((l) => l.finalSlot!.date === today);
  const nextLesson = d.upcoming[0];
  const fmtHour = (t: string) => t.replace(":", " h ").replace(/ h 00$/, " h");
  const line2 = nextToday ? `prêt pour la séance de ${fmtHour(nextToday.finalSlot!.time)} ?` : nextLesson ? `prochain cours : ${new Date(`${nextLesson.finalSlot!.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à ${fmtHour(nextLesson.finalSlot!.time)}.` : todos.length === 0 ? "tout est à jour. Belle séance !" : `${todos.length} chose${todos.length > 1 ? "s" : ""} à faire aujourd'hui.`;
  const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const week = [...d.upcoming.map((l) => ({ l, wait: false })), ...d.booked.map((l) => ({ l, wait: true }))]
    .filter((x) => x.l.finalSlot!.date >= today && x.l.finalSlot!.date <= inAWeek)
    .sort((x, y) => (x.l.finalSlot!.date + x.l.finalSlot!.time).localeCompare(y.l.finalSlot!.date + y.l.finalSlot!.time));
  const ICON: Record<string, string> = { home: "M4 11l8-7 8 7v9H4z M10 20v-6h4v6", star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", doc: "M7 3h7l4 4v14H7z M14 3v4h4 M10 12h5 M10 16h5", film: "M5.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9A2.5 2.5 0 015.5 5z M10 9.5v5l4.5-2.5z", cal: "M6 5h12a2.5 2.5 0 012.5 2.5v10A2.5 2.5 0 0118 20H6a2.5 2.5 0 01-2.5-2.5v-10A2.5 2.5 0 016 5z M3.5 10h17 M8 3v4 M16 3v4", shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4", arrow: "M5 12h14 M13 6l6 6-6 6" };
  const Ico = ({ n, cls = "size-5" }: { n: string; cls?: string }) => <svg viewBox="0 0 24 24" className={cls + " shrink-0"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[n].split(" M").map((d, i) => <path key={i} d={(i ? "M" : "") + d} />)}</svg>;
  const toDo = adultWait.length + d.booked.length + d.pending.length + d.profsWaiting;
  const homeInSidebar = useRegisterSubNav([["Donner des étoiles", "/coach/centre/fin-de-cours"], ["Bulletins", "/coach/centre?onglet=bulletins"], ["Vidéos et gestes", "/coach/centre?onglet=videos"]].map(([label, to]) => ({ key: to, label, to, active: false })));
  const menu: [string, string, string][] = [["home", "Accueil", "/coach"], ["star", "Donner des étoiles", "/coach/centre/fin-de-cours"], ["doc", "Bulletins", "/coach/centre?onglet=bulletins"], ["film", "Vidéos et gestes", "/coach/centre?onglet=videos"], ["cal", "Planning du club", "/coach/club"], ["shield", "Sécurité", "/coach/securite"]];
  const dayLabel = (iso: string) => { const dt = new Date(`${iso}T12:00:00`); return dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }).replace(".", "").replace(/^./, (c) => c.toUpperCase()); };
  const byDay = week.reduce<{ day: string; items: typeof week }[]>((acc, x) => { const k = x.l.finalSlot!.date; const g = acc.find((y) => y.day === k); if (g) g.items.push(x); else acc.push({ day: k, items: [x] }); return acc; }, []);
  const spaceDot = { Adultes: "bg-[#c9ad77]", Jeunes: "bg-[#8fb89a]", Compte: "bg-[#d6cdbb]" };
  const stat = (n: number, label: string, color: string) => <div className="rounded border border-[#4a4234] bg-[#26211a] px-4 py-3"><div className="text-sm text-[#cfc5b0]">{label}</div><b className={"block font-display text-4xl font-semibold leading-tight " + color}>{n}</b></div>;
  return (
    <div className="bg-[#1f1a12] text-white print:bg-white print:text-ink">
      <div className="mx-auto flex max-w-[2400px] gap-0 max-lg:flex-col lg:min-h-[calc(100dvh-8.75rem)]">
        <aside aria-label="Raccourcis" className={(homeInSidebar ? "md:hidden " : "") + "min-w-0 shrink-0 border-[#3a3326] bg-[#17140f] p-3 lg:w-56 lg:border-r lg:p-4 print:hidden"}>
          <p className="m-0 mb-2 hidden px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a89c82] lg:block">Menu</p>
          <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 lg:grid lg:gap-1.5 lg:overflow-visible">
            {menu.map(([ic, label, to], i) => <li key={label} className="max-lg:shrink-0"><Link to={to} aria-current={i === 0 ? "page" : undefined} className={"flex items-center gap-3 rounded px-3 py-2.5 text-sm font-bold no-underline max-lg:whitespace-nowrap " + (i === 0 ? "bg-champagne text-ink" : "text-[#d6cdbb] hover:bg-[#2b261d] hover:text-white")}><Ico n={ic} />{label}</Link></li>)}
          </ul>
        </aside>
        <div className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-ball">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
              <h1 className="m-0 mt-1 text-3xl leading-tight text-white sm:text-4xl">{h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"} {first}</h1>
              <p className="m-0 mt-1 text-[#d6cdbb]">{line2}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link to="/coach/centre/fin-de-cours" className="inline-flex items-center gap-2 rounded bg-champagne px-4 py-2.5 font-display font-bold text-ink no-underline shadow-md hover:brightness-95"><Ico n="star" />Fin de cours</Link>
              <Link to="/coach/centre?onglet=videos" className="inline-flex items-center gap-2 rounded bg-[#2b261d] px-4 py-2.5 font-display font-extrabold text-white no-underline hover:bg-[#3a3326]"><Ico n="film" />Analyser une vidéo</Link>
              <Link to="/coach/prof" className="inline-flex items-center gap-2 rounded bg-[#2b261d] px-4 py-2.5 font-display font-extrabold text-white no-underline hover:bg-[#3a3326]"><Ico n="cal" />Mon agenda</Link>
            </div>
          </header>
          <ClubNotice />
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Chiffres du jour">
            {stat(todos.length, todos.length > 1 ? "À faire" : "À faire", "text-[#c9ad77]")}
            {stat(d.booked.length, "Cours à confirmer", "text-[#c9ad77]")}
            {stat(adultWait.length + youthWait.length, adultWait.length + youthWait.length > 1 ? "Vidéos à analyser" : "Vidéo à analyser", "text-[#d6cdbb]")}
            {stat(d.players.length, d.players.length > 1 ? "Jeunes suivis" : "Jeune suivi", "text-[#8fb89a]")}
          </div>
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <HomeFold id="todo" title="À faire aujourd'hui" count={String(todos.length)} preview={todos.length ? `${todos.slice(0, 2).map((t) => t.text).join(" · ")}${todos.length > 2 ? ` · +${todos.length - 2}` : ""}` : "Tout est à jour 🎾"}>
              {todos.length === 0 ? <p className="m-0 border-t border-[#3a3326] pt-3 text-center text-[#d6cdbb]">Tout est à jour 🎾</p> : (
                <ul className="m-0 grid list-none p-0">
                  {todos.slice(0, 6).map((t, i) => (
                    <li key={i} className="flex items-center gap-3 border-t border-[#3a3326] py-2">
                      <span aria-hidden="true" className={"size-2.5 shrink-0 rounded-full " + spaceDot[t.space]} />
                      <span className="min-w-0 flex-1 text-sm leading-snug"><strong className="text-white">{t.text}</strong> <span className="text-[#cfc5b0]">· {t.space === "Compte" ? "Mon compte" : t.space === "Adultes" ? "Adultes" : "Jeunes"}</span></span>
                      <Link to={t.to} className="shrink-0 rounded bg-champagne px-3 py-1.5 text-sm font-semibold text-ink no-underline hover:bg-champagne-deep">{t.cta}</Link>
                    </li>
                  ))}
                </ul>
              )}
              {todos.length > 6 && <p className="m-0 border-t border-[#3a3326] pt-2 text-sm text-[#cfc5b0]">… et {todos.length - 6} autre{todos.length - 6 > 1 ? "s" : ""} dans les espaces Adultes et Jeunes.</p>}
            </HomeFold>
            <HomeFold id="week" title="Ma semaine" count={`${week.length} cours`} preview={week.length ? week.slice(0, 3).map(({ l }) => `${dayLabel(l.finalSlot!.date)} ${fmtHour(l.finalSlot!.time)} ${adultName(l.member, "Adhérent")}`).join(" · ") : "Aucun cours dans les 7 prochains jours"}>
              {week.length === 0 ? <p className="m-0 border-t border-[#3a3326] pt-3 text-[#d6cdbb]">Aucun cours dans les 7 prochains jours.</p> : (
                <ul className="m-0 grid list-none p-0">
                  {byDay.map((g) => (
                    <li key={g.day} className="flex gap-3 border-t border-[#3a3326] py-2">
                      <b className="w-20 shrink-0 font-display text-sm text-white">{dayLabel(g.day)}</b>
                      <span className="grid min-w-0 flex-1 gap-0.5 text-sm">{g.items.map(({ l, wait }) => <span key={l.id} className="min-w-0 truncate text-[#efe8da]"><b className="font-display text-white">{fmtHour(l.finalSlot!.time)}</b> {adultName(l.member, "Adhérent")} · {l.objective}{l.prof && l.prof.id !== me?.id ? ` · avec ${l.prof.firstName ?? "un prof"}` : ""}{wait && <b className="ml-1.5 text-[#ffe08a]"> (à confirmer)</b>}</span>)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/coach/prof" className="mt-1 inline-block border-t border-[#3a3326] pt-2 text-sm font-bold text-[#c9ad77] no-underline hover:underline">Voir mon agenda →</Link>
            </HomeFold>
          </div>
          <section className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2" aria-label="Mes deux espaces">
            <div className="relative grid min-h-44 content-between gap-3 overflow-hidden rounded border border-[#4a4234] p-5 text-white" style={{ background: "#2b261d" }}>
              <div><span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider">Espace 1</span><h2 className="m-0 mt-2 text-2xl text-white">Adultes · Coaching</h2><p className="m-0 mt-1 text-white/90">Cours particuliers, vidéos, professeurs</p></div>
              <div className="flex items-end justify-between gap-3"><div><b className="font-display text-4xl font-semibold leading-none">{toDo}</b> <span className="font-bold">à traiter</span><small className="block text-white/85">{d.booked.length} cours à confirmer · {adultWait.length} vidéo{adultWait.length > 1 ? "s" : ""} · {d.profsWaiting} prof à valider</small></div><Link to="/coach/adultes" className="home-open inline-flex items-center gap-2 no-underline">Ouvrir <Ico n="arrow" cls="size-4" /></Link></div>
            </div>
            <div className="relative grid min-h-44 content-between gap-3 overflow-hidden rounded border border-[#4a4234] p-5 text-white" style={{ background: "#26211a" }}>
              <div><span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider">Espace 2</span><h2 className="m-0 mt-2 text-2xl text-white">Jeunes · Centre de compétition</h2><p className="m-0 mt-1 text-white/90">Dossiers, objectifs, bulletins, étoiles</p></div>
              <div className="flex items-end justify-between gap-3"><div><b className="font-display text-4xl font-semibold leading-none">{d.players.length}</b> <span className="font-bold">jeune{d.players.length > 1 ? "s" : ""} suivi{d.players.length > 1 ? "s" : ""}</span><small className="block text-white/85">{youthWait.length} vidéo{youthWait.length > 1 ? "s" : ""} à analyser</small></div><Link to="/coach/centre" className="home-open inline-flex items-center gap-2 no-underline">Ouvrir <Ico n="arrow" cls="size-4" /></Link></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Carte repliable de l'accueil du coach : fermée par défaut, le choix (ouvert / fermé) est gardé seulement dans le navigateur
function HomeFold({ id, title, count, preview, children }: { id: string; title: string; count: string; preview: string; children: React.ReactNode }) {
  const KEY = "cc-home-open";
  const read = () => { try { return !!JSON.parse(localStorage.getItem(KEY) || "{}")[id]; } catch { return false; } };
  const [open, setOpen] = useState(read);
  const toggle = () => { const n = !open; setOpen(n); try { const o = JSON.parse(localStorage.getItem(KEY) || "{}"); o[id] = n; localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* sans mémoire */ } };
  return (
    <section className="rounded border border-[#4a4234] bg-[#26211a] px-4 py-3">
      <button type="button" aria-expanded={open} onClick={toggle} className="flex w-full items-center gap-3 border-0 bg-transparent p-0 text-left text-white">
        <h2 className="m-0 whitespace-nowrap text-lg text-white">{title}</h2>
        <span className="shrink-0 rounded-full bg-champagne px-2.5 py-0.5 text-xs font-semibold text-ink">{count}</span>
        <span className={"min-w-0 flex-1 truncate text-right text-sm text-[#cfc5b0] " + (open ? "invisible" : "")}>{preview}</span>
        <svg viewBox="0 0 24 24" className={"size-5 shrink-0 text-ball transition-transform " + (open ? "rotate-90" : "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </section>
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
        <TabsBar side={false} label="Sections de l'espace adultes" active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[["demandes", "📅 Cours particuliers", d.pending.length + d.booked.length], ["videos", "🎬 Vidéos à analyser", waiting.length], ["profs", "👩‍🏫 Professeurs", d.profsWaiting], ["historique", "🗂️ Historique"]]} />
        {tab === "demandes" && (
          <div className="grid gap-6">
            <ul className="m-0 grid list-none gap-3 p-0">
              {d.pending.map((l) => <LessonRow key={l.id} l={l} onDone={d.reload} />)}
              {!d.pending.length && <li><Empty>Aucune ancienne demande à clôturer 🎾</Empty></li>}
            </ul>
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
        actions={<><Link to="/coach/centre/fin-de-cours" className="btn bg-champagne text-ink no-underline hover:bg-champagne-deep">⭐ Fin de cours</Link>{isCoach && <Link to="/coach/centre/apercu-entraineur" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">👀 Voir comme un entraîneur de comité</Link>}{isCoach && <button className="btn border-2 border-white/70 text-white hover:bg-white hover:text-ink" aria-expanded={open} onClick={() => { setTab("joueurs"); setOpen(!open); }}>+ Ajouter un joueur</button>}</>}
      />
      <Page>
        {!isCoach && <ClubNotice />}
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
