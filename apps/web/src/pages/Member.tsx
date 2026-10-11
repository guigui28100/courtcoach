import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get, post, put, del } from "../api";
import { useAuth } from "../auth";
import { Radar } from "../components/Radar";
import { MatchTable, SkillBars, useFollowUp } from "../components/Suivi";
import { ADULT_LEVELS, CourseStar, fmtSlot, Slot, todayIso, missionPercent, missionStars, axisAverage, AXES, currentSeason, EVAL_AXES, fmtAvg, fmtDate, fullName, Goal, goalApplies, isCarriedOver, Lesson, overallAverage, periodLabel, Player, previousPeriod, ratedCount, STATUS as GOAL_STATUS, statusAt, trendCommon, trimesterOf, VideoRow } from "../types";
import { BulletinShelf } from "../components/BulletinShelf";
import { FamilyTournaments } from "../components/Tournaments";
import { FamilyInfo, infoMissing } from "../components/FamilyInfo";
import { StarsCard, StarsRadar, useStars } from "../components/Stars";
import { Avatar, Empty, Err, Field, Page, PageHead, ProgressBar, SideLayout, TabLabel, TabsBar } from "../components/ui";
import { useVideos, VideoList, VideosIntro, VideoUpload } from "../components/Videos";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Vidéos de l'adhérent adulte : il envoie, le coach analyse, ils discutent.
// Menu repliable, FERMÉ par défaut (on clique pour voir) ; une pastille rappelle le nombre de nouveautés
function Fold({ title, count, hot = 0, onOpen, children }: { title: string; count: number; hot?: number; onOpen?: () => void; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border-2 border-line bg-white" onToggle={(e) => { if (e.currentTarget.open) onOpen?.(); }}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <h3 className="m-0 text-lg">{title} <span className="font-body text-base font-normal text-muted">({count})</span>{hot > 0 && <span className="ml-2 rounded-full bg-clay px-2.5 py-0.5 align-middle text-sm font-bold text-white">{hot} nouveau{hot > 1 ? "x" : ""}</span>}</h3>
        <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="grid gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}

// ----- Mes demandes de cours : une liste claire (une carte par demande) et un formulaire en 4 petites étapes -----
const STATUS_UI = {
  PENDING: { icon: "⏳", label: "En attente", bar: "#c08a00", soft: "#fff8e1", ink: "#7a5a00" },
  PROPOSED: { icon: "💬", label: "À confirmer", bar: "#2a6fb0", soft: "#eaf2fb", ink: "#1f5a96" },
  ACCEPTED: { icon: "✅", label: "Confirmé", bar: "#2f8f5b", soft: "#eef8f1", ink: "#1d6b43" },
  REFUSED: { icon: "❌", label: "Refusée", bar: "#c0392b", soft: "#fdf0ee", ink: "#9a2a1f" },
} as const;
const TYPE_UI: Record<string, [string, string, string]> = { individuel: ["🎾", "Cours individuel", "Sur le court, toi et ton coach"], duo: ["👥", "Cours à deux", "Avec un partenaire"] };
const GOALS = ["Coup droit", "Revers", "Service", "Retour de service", "Volée", "Smash", "Jeu de jambes", "Autre"];
const MOMENTS = ["Peu importe", "Matin", "Après-midi", "Soirée"];
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// Pastille à cocher (choix unique ou multiple)
function Chip({ type, name, value, defaultChecked }: { type: "radio" | "checkbox"; name: string; value: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center rounded-full border-2 border-line bg-white px-4 font-semibold transition-colors hover:border-clay/50 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea] has-[:checked]:text-clay has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />{value}
    </label>
  );
}

function NewLessonForm({ preview, onClose, onSent }: { preview: boolean; onClose: () => void; onSent: () => void }) {
  const [err, setErr] = useState("");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) { setErr("Aperçu : rien n'est envoyé. Un adulte verrait ici que sa demande est partie."); return; }
    const f = new FormData(e.currentTarget); setErr("");
    try { await post("/lessons", { type: f.get("type"), objective: String(f.get("objective")), days: f.getAll("days"), moment: f.get("moment"), message: String(f.get("message") || "") || undefined }); onClose(); onSent(); } catch (x) { setErr((x as Error).message); }
  }
  const legend = "mb-2 flex items-center gap-2 font-display text-base font-bold";
  const num = "grid h-7 w-7 place-items-center rounded-full bg-clay text-sm text-white";
  return (
    <form onSubmit={send} className="grid gap-6 rounded-3xl border-2 border-clay bg-white p-5 shadow-sm sm:p-6" noValidate aria-label="Nouvelle demande de cours">
      <fieldset className="m-0 border-0 p-0"><legend className={legend}><span className={num}>1</span>Quel type de cours ?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(TYPE_UI).map(([k, [icon, title, sub]], i) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-white p-3 transition-colors hover:border-clay/50 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink">
              <input type="radio" name="type" value={k} defaultChecked={i === 0} className="sr-only" />
              <span aria-hidden="true" className="text-3xl">{icon}</span><span className="grid"><strong>{title}</strong><small className="text-muted">{sub}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0"><legend className={legend}><span className={num}>2</span>Sur quoi veux-tu travailler ?</legend>
        <div className="flex flex-wrap gap-2">{GOALS.map((g, i) => <Chip key={g} type="radio" name="objective" value={g} defaultChecked={i === 0} />)}</div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0"><legend className={legend}><span className={num}>3</span>Quels jours t'arrangent ? <small className="font-body font-normal text-muted">(facultatif)</small></legend>
        <div className="flex flex-wrap gap-2">{DAYS.map((d) => <Chip key={d} type="checkbox" name="days" value={d} />)}</div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0"><legend className={legend}><span className={num}>4</span>À quel moment de la journée ?</legend>
        <div className="flex flex-wrap gap-2">{MOMENTS.map((x, i) => <Chip key={x} type="radio" name="moment" value={x} defaultChecked={i === 0} />)}</div>
      </fieldset>
      <Field label="Un message pour ton coach (facultatif)" id="message"><textarea id="message" name="message" className="input" maxLength={500} placeholder="Ex. : je voudrais fiabiliser mon service avant le tournoi" /></Field>
      <Err msg={err} />
      <div className="flex flex-wrap gap-2"><button className="btn-clay">Envoyer ma demande</button><button type="button" className="btn-outline" onClick={onClose}>Annuler</button></div>
    </form>
  );
}

const TYPE_SHORT: Record<string, string> = { individuel: "Individuel", duo: "À deux" };
const MONTH_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Petite pastille de calendrier : le jour en gros, le mois en petit
function DateBadge({ slot, tone }: { slot: Slot; tone: "green" | "blue" }) {
  const d = new Date(`${slot.date}T12:00:00`);
  return (
    <span aria-hidden="true" className={"grid h-14 w-14 shrink-0 place-items-center rounded-xl text-center leading-none " + (tone === "green" ? "bg-[#eef8f1] text-[#1d6b43]" : "bg-[#eaf2fb] text-[#1f5a96]")}>
      <span className="grid"><small className="text-[0.7rem] font-bold uppercase">{MONTH_SHORT[d.getMonth()]}</small><strong className="font-display text-2xl">{d.getDate()}</strong></span>
    </span>
  );
}

// Une ligne par demande : l'essentiel seulement (sujet, date ou disponibilités, état)
function LessonLine({ l, isNew }: { l: Lesson; isNew: boolean }) {
  const title = `${l.objective} · ${TYPE_SHORT[l.type] ?? "Cours"}`;
  const state = { PENDING: ["⏳ En attente", "#7a5a00"], PROPOSED: ["💬 À confirmer", "#1f5a96"], ACCEPTED: ["✅ Confirmé", "#1d6b43"], REFUSED: ["❌ Refusée", "#9a2a1f"] }[l.status];
  const sub = l.status === "ACCEPTED" && l.finalSlot ? `${fmtSlot(l.finalSlot)}${l.place ? ` · ${l.place}` : ""}`
    : l.status === "PENDING" ? `Tes disponibilités : ${l.days.length ? l.days.join(", ").toLowerCase() : "à définir"} · ${l.moment.toLowerCase()}`
    : l.coachReply ? `« ${l.coachReply} »` : "";
  return (
    <li className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[auto_1fr_auto]">
      {l.status === "ACCEPTED" && l.finalSlot ? <DateBadge slot={l.finalSlot} tone="green" /> : <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-xl bg-sand text-2xl">{l.status === "PENDING" ? "⏳" : "🎾"}</span>}
      <div className="grid min-w-0 gap-0.5">
        <strong className="leading-tight">{title}{isNew && <span className="ml-2 rounded-full bg-clay px-2 py-0.5 align-middle text-xs font-bold text-white">nouveau</span>}</strong>
        {sub && <span className="text-sm text-muted">{sub}</span>}
        {l.status === "ACCEPTED" && l.coachReply && <span className="text-sm text-muted">💬 « {l.coachReply} »</span>}
        {l.status === "PENDING" && l.declinedSlot && <span className="text-sm text-muted">Tu n'étais pas disponible le {fmtSlot(l.declinedSlot)} : ton coach te proposera une autre date.</span>}
      </div>
      <span className="col-span-2 text-sm font-bold sm:col-span-1" style={{ color: state[1] }}>{state[0]}</span>
    </li>
  );
}

// Grand encadré : le prochain cours confirmé
function NextCourse({ l }: { l: Lesson }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-[#1d6b43] p-5 text-white shadow-sm">
      <DateBadge slot={l.finalSlot!} tone="green" />
      <div className="grid min-w-0 gap-0.5">
        <small className="font-bold uppercase tracking-wide text-white/80">Ton prochain cours</small>
        <strong className="font-display text-2xl leading-tight">{fmtSlot(l.finalSlot!)}</strong>
        <span className="text-white/90">{l.objective} · {TYPE_SHORT[l.type] ?? "Cours"}{l.place ? ` · ${l.place}` : ""}</span>
      </div>
    </div>
  );
}

// Encadré à traiter : le coach propose une date, l'adulte confirme ou non
function ToConfirm({ l, onRespond }: { l: Lesson; onRespond: (l: Lesson, action: "confirm" | "decline", message?: string) => Promise<void> }) {
  const [no, setNo] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function reply(action: "confirm" | "decline") {
    setErr(""); setBusy(true);
    try { await onRespond(l, action, action === "decline" ? msg || undefined : undefined); setNo(false); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-3 rounded-3xl border-2 border-[#2a6fb0] bg-[#eaf2fb] p-5 text-[#1f5a96]">
      <div className="flex flex-wrap items-center gap-4">
        {l.finalSlot && <DateBadge slot={l.finalSlot} tone="blue" />}
        <div className="grid min-w-0 gap-0.5">
          <small className="font-bold uppercase tracking-wide">À confirmer</small>
          <strong className="font-display text-2xl leading-tight">{l.finalSlot ? fmtSlot(l.finalSlot) : ""}</strong>
          <span>{l.objective} · {TYPE_SHORT[l.type] ?? "Cours"}{l.place ? ` · ${l.place}` : ""}</span>
        </div>
      </div>
      {l.coachReply && <p className="m-0 text-sm">💬 « {l.coachReply} »</p>}
      {!no ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2"><button className="btn-clay" disabled={busy} onClick={() => reply("confirm")}>✅ Je confirme ce cours</button><button className="btn-outline !bg-white" onClick={() => setNo(true)}>Je ne suis pas disponible</button></div>
          <small>Ton coach ne se déplacera que si tu confirmes.</small>
        </div>
      ) : (
        <div className="grid gap-2 text-ink">
          <input className="input !min-h-11" maxLength={200} aria-label="Message pour ton coach (facultatif)" placeholder="Un mot pour ton coach (facultatif)" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="flex flex-wrap gap-2"><button className="btn-danger" disabled={busy} onClick={() => reply("decline")}>Envoyer : pas disponible</button><button className="btn-outline !bg-white" onClick={() => setNo(false)}>Retour</button></div>
        </div>
      )}
      <Err msg={err} />
    </div>
  );
}

const COPY = { icon: "📅", title: "Mes cours particuliers", button: "+ Demander un cours", first: "Demander mon premier cours", none: "Tu n'as pas encore de cours particulier.", ok: "✅ Demande envoyée ! Ton coach va te répondre, tu la verras ici.", groups: ["✅ Mes cours confirmés", "⏳ En attente de réponse", "Demandes refusées"], emptyTitle: "Envie de progresser avec ton coach ?", emptyText: "Un cours particulier, c'est un vrai cours sur le court avec ton coach. Choisis le type, dis-nous sur quoi travailler et quand : il te répond ici." };

function LessonsSection({ lessons, preview, seenLocal, onSent, onSeen, onRespond }: { lessons: Lesson[]; preview: boolean; seenLocal: string[]; onSent: () => void; onSeen: (l: Lesson) => void; onRespond: (l: Lesson, action: "confirm" | "decline", message?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const c = COPY;
  const isNew = (l: Lesson) => l.status !== "PENDING" && l.status !== "PROPOSED" && !l.seenByMemberAt && !seenLocal.includes(l.id);
  const stamp = (l: Lesson) => (l.finalSlot ? l.finalSlot.date + l.finalSlot.time : "9");
  const soonest = (a: Lesson, b: Lesson) => stamp(a).localeCompare(stamp(b)); // le prochain cours d'abord
  const latest = (a: Lesson, b: Lesson) => b.createdAt.localeCompare(a.createdAt);
  const toConfirm = lessons.filter((l) => l.status === "PROPOSED").sort(soonest);
  const confirmed = lessons.filter((l) => l.status === "ACCEPTED").sort(soonest);
  const next = confirmed.find((l) => l.finalSlot && l.finalSlot.date >= todayIso());
  const waiting = lessons.filter((l) => l.status === "PENDING").sort(latest);
  const refused = lessons.filter((l) => l.status === "REFUSED").sort(latest);
  const folds = [
    { title: "✅ Mes cours confirmés", list: confirmed },
    { title: "⏳ En attente de réponse", list: waiting },
    { title: "Demandes refusées", list: refused },
  ].filter((g) => g.list.length > 0);
  const ask = () => { setOpen(true); setSent(false); };
  return (
    <section aria-labelledby="t-cours" className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="t-cours" className="m-0">{c.icon} {c.title}</h2>
        {!open && <button className="btn-clay" onClick={ask}>{c.button}</button>}
      </div>
      {sent && <p role="status" className="m-0 rounded-2xl border-2 border-ok bg-[#eef8f1] p-3 font-bold text-ok">{c.ok}</p>}
      {open && <NewLessonForm preview={preview} onClose={() => setOpen(false)} onSent={() => { setSent(true); onSent(); }} />}
      {toConfirm.map((l) => <ToConfirm key={l.id} l={l} onRespond={onRespond} />)}
      {next && <NextCourse l={next} />}
      {folds.map((g) => (
        <Fold key={g.title} title={g.title} count={g.list.length} hot={g.list.filter(isNew).length} onOpen={() => g.list.filter(isNew).forEach(onSeen)}>
          <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-xl bg-white p-0 ring-1 ring-line">{g.list.map((l) => <LessonLine key={l.id} l={l} isNew={isNew(l)} />)}</ul>
        </Fold>
      ))}
      {lessons.length === 0 && !open && (
        <div className="grid justify-items-center gap-2 rounded-3xl border-2 border-dashed border-line bg-white p-8 text-center">
          <span aria-hidden="true" className="text-5xl">🎾</span>
          <p className="m-0 text-lg font-bold">{c.emptyTitle}</p>
          <p className="m-0 max-w-md text-muted">{c.emptyText}</p>
          <button className="btn-clay mt-1" onClick={ask}>{c.first}</button>
        </div>
      )}
    </section>
  );
}

// Profil de l'adulte : le coach voit ces informations (nom, âge, classement ou niveau) sur ses demandes
function ProfileCard({ preview }: { preview: boolean }) {
  const { me, reload } = useAuth();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const missing = !preview && (!me?.lastName || !me?.birthYear || !me?.level || !me?.phone);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) { setMsg({ ok: false, text: "Aperçu : rien n'est enregistré." }); return; }
    const f = new FormData(e.currentTarget);
    try {
      await put("/auth/me/profile", { firstName: String(f.get("firstName") || ""), lastName: String(f.get("lastName") || ""), birthYear: Number(f.get("birthYear")) || undefined, level: String(f.get("level") || ""), phone: String(f.get("phone") || "") });
      await reload(); setMsg({ ok: true, text: "Enregistré ✓" });
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  return (
    <section aria-labelledby="t-prof" className="card grid gap-3">
      <h2 id="t-prof" className="m-0 text-xl">🙋 Mon profil{missing && <span className="ml-2 rounded-full bg-[#fff3cd] px-3 py-0.5 align-middle text-sm font-bold text-[#7a5a00]">à compléter</span>}</h2>
      <p className="hint m-0">Ton coach voit ces informations sur tes demandes, pour préparer ton cours et te joindre. Tout est facultatif.</p>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" id="p-first"><input id="p-first" name="firstName" className="input" maxLength={60} defaultValue={preview ? "Marie" : me?.firstName ?? ""} /></Field>
          <Field label="Nom" id="p-last"><input id="p-last" name="lastName" className="input" maxLength={60} defaultValue={preview ? "Durand" : me?.lastName ?? ""} /></Field>
          <Field label="Année de naissance" id="p-year"><input id="p-year" name="birthYear" type="number" inputMode="numeric" min={1920} max={2030} className="input" defaultValue={preview ? 1985 : me?.birthYear ?? ""} /></Field>
          <Field label="Classement ou niveau" id="p-level"><select id="p-level" name="level" className="input" defaultValue={preview ? "30/2" : me?.level ?? ""}><option value="">Je ne sais pas</option>{ADULT_LEVELS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Téléphone" id="p-phone"><input id="p-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} className="input" placeholder="06 12 34 56 78" defaultValue={preview ? "06 12 34 56 78" : me?.phone ?? ""} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-3"><button className="btn-clay">Enregistrer</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
      </form>
    </section>
  );
}

// Espace de l'adhérent adulte : demandes de cours et réponse du coach, visibles tout de suite.
// Exemples FICTIFS montrés au coach dans « Voir comme un adulte » (aucune vraie demande, aucune donnée de personne)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const EXAMPLE_LESSONS: Lesson[] = [
  { id: "ex1", type: "individuel", objective: "Service", days: ["Mardi", "Jeudi"], moment: "Soirée", message: "", status: "ACCEPTED", finalSlot: { date: inDays(4), time: "18:00" }, place: "Court 2", confirmedAt: "2026-10-05T12:00:00Z", coachReply: "Parfait, à mardi !", answeredAt: "2026-10-05T10:00:00Z", seenByMemberAt: "2026-10-05T12:00:00Z", createdAt: "2026-10-03T09:00:00Z" },
  { id: "ex2", type: "individuel", objective: "Revers", days: ["Samedi"], moment: "Matin", message: "", status: "PROPOSED", finalSlot: { date: inDays(7), time: "10:30" }, place: "Court 1", coachReply: "Samedi matin, ça te va ?", answeredAt: "2026-10-08T10:00:00Z", seenByMemberAt: null, createdAt: "2026-10-07T09:00:00Z" },
  { id: "ex3", type: "individuel", objective: "Smash", days: ["Mercredi"], moment: "Après-midi", message: "", status: "PENDING", coachReply: "", answeredAt: null, seenByMemberAt: null, createdAt: "2026-10-09T09:00:00Z" },
  { id: "ex4", type: "duo", objective: "Volée", days: ["Samedi"], moment: "Matin", message: "", status: "REFUSED", coachReply: "Pas de place ce mois-ci, on regarde en novembre.", answeredAt: "2026-10-04T10:00:00Z", seenByMemberAt: "2026-10-04T12:00:00Z", createdAt: "2026-10-02T09:00:00Z" },
];

type AdultTab = "cours" | "videos" | "profil";

// Espace de l'adulte : 3 rubriques (cours particuliers · vidéos à analyser · profil)
function AdultView({ preview, lessons, seenLocal, onLessonsChanged, onSeen, onRespond, videos, onVideosChanged }: {
  preview: boolean; lessons: Lesson[]; seenLocal: string[]; onLessonsChanged: () => void; onSeen: (l: Lesson) => void; onRespond: (l: Lesson, action: "confirm" | "decline", message?: string) => Promise<void>; videos: VideoRow[] | null; onVideosChanged: () => void;
}) {
  const { me, eraseAccount } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: AdultTab = (["cours", "videos", "profil"] as const).find((k) => k === params.get("onglet")) ?? "cours";
  const go = (k: string) => { setParams(k === "cours" ? {} : { onglet: k }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const unseen = (l: Lesson) => l.status === "PROPOSED" || (l.status !== "PENDING" && !l.seenByMemberAt && !seenLocal.includes(l.id));
  const newAnswers = lessons.filter(unseen).length;
  const fresh = (videos ?? []).filter((v) => v.analysis?.sentAt && !v.seenAt);
  const waiting = (videos ?? []).filter((v) => !v.analysis?.sentAt), done = (videos ?? []).filter((v) => v.analysis?.sentAt);
  const missing = !preview && (!me?.lastName || !me?.birthYear || !me?.level || !me?.phone);

  async function exportData() {
    const data = await get("/auth/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "mes-donnees-courtcoach.json" });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      {preview && (
        <div role="note" className="border-b-4 border-[#c08a00] bg-[#fff3cd] px-4 py-3 text-[#5c4300]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="m-0"><strong>👀 Aperçu : voici ce que voit un adulte.</strong> Les demandes ci-dessous sont des exemples inventés, rien n'est envoyé ni enregistré.</p>
            <Link to="/coach/adultes" className="btn-ink btn-sm no-underline">← Retour aux demandes</Link>
          </div>
        </div>
      )}
      <PageHead eyebrow="Mon espace" title={!preview && me?.firstName ? `Bonjour ${me.firstName} !` : "Bienvenue sur CourtCoach !"}>Tes cours particuliers, tes vidéos et ton profil, au même endroit.</PageHead>
      <Page>
        <SideLayout nav={<TabsBar label="Mon espace" active={tab} onChange={go} tabs={[["cours", "📅 Mes cours", newAnswers], ["videos", "🎬 Mes vidéos", fresh.length], ["profil", "🙋 Mon profil", missing ? 1 : 0]]} />}>
          {tab === "cours" && <LessonsSection lessons={lessons} preview={preview} seenLocal={seenLocal} onSent={onLessonsChanged} onSeen={onSeen} onRespond={onRespond} />}

          {tab === "videos" && (
            <section aria-labelledby="t-vid" className="grid gap-5">
              <div className="grid gap-0.5"><h2 id="t-vid" className="m-0">🎬 Mes vidéos à analyser</h2><p className="m-0 text-muted">Envoie une vidéo de quelques coups : ton coach la reçoit, l'analyse puis te la renvoie. Vous pouvez ensuite discuter ensemble, à partir de l'analyse, par messages.</p></div>
              {fresh.length > 0 && <p role="status" className="m-0 rounded-2xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">✅ Le coach a analysé {fresh.length > 1 ? `${fresh.length} de tes vidéos` : "une de tes vidéos"} : ouvre-la ci-dessous.</p>}
              <div className="card grid gap-3">
                <h3 className="m-0 text-lg">📤 Envoyer une vidéo</h3>
                {preview ? <p className="m-0 rounded-xl border-2 border-dashed border-line p-3 text-sm text-muted">Dans l'aperçu, l'envoi de vidéo est désactivé. Un adulte voit ici un bouton pour choisir sa vidéo.</p> : <VideoUpload onDone={onVideosChanged} />}
              </div>
              {preview ? <Empty>Tu n'as pas encore envoyé de vidéo.</Empty> : (
                <>
                  <Fold title="⏳ En attente d'analyse" count={waiting.length}><VideoList videos={waiting} onChanged={onVideosChanged} empty="Aucune vidéo en attente." /></Fold>
                  <Fold title="✅ Analysées par ton coach" count={done.length} hot={fresh.length}><VideoList videos={done} onChanged={onVideosChanged} empty="Pas encore de vidéo analysée." /></Fold>
                </>
              )}
            </section>
          )}

          {tab === "profil" && (
            <>
              <ProfileCard preview={preview} />
              <section className="card grid gap-3 border-dashed">
                <h2 className="m-0 text-lg">Mes données</h2>
                <p className="hint m-0">Tu peux récupérer ou effacer tes données quand tu veux. <Link to="/confidentialite" className="font-bold text-clay underline">Politique de confidentialité</Link></p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/mot-de-passe" className="btn-outline btn-sm no-underline">Changer mon mot de passe</Link>
                  <button className="btn-outline btn-sm" disabled={preview} onClick={exportData}>Télécharger mes données</button>
                  <button className="btn-danger btn-sm" disabled={preview} onClick={async () => { if (confirm("Supprimer définitivement ton compte et tes données ?")) { await eraseAccount(); window.location.href = "/"; } }}>Supprimer mon compte</button>
                </div>
              </section>
            </>
          )}
        </SideLayout>
      </Page>
    </>
  );
}

export function AdultSpace() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const load = useCallback(() => { get<Lesson[]>("/lessons").then(setLessons); }, []);
  useEffect(load, [load]);
  const [version, setVersion] = useState(0);
  const videos = useVideos(version);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  return <AdultView preview={false} lessons={lessons} seenLocal={[]} onLessonsChanged={load} onSeen={async (l) => { await post(`/lessons/${l.id}/seen`); load(); }} onRespond={async (l, action, message) => { await post(`/lessons/${l.id}/respond`, { action, message }); load(); }} videos={videos} onVideosChanged={refresh} />;
}

// Aperçu du coach : exemples inventés, aucun appel au serveur
export function AdultPreview() {
  const [seen, setSeen] = useState<string[]>([]);
  return <AdultView preview lessons={EXAMPLE_LESSONS} seenLocal={seen} onLessonsChanged={() => {}} onSeen={(l) => setSeen((s) => [...s, l.id])} onRespond={async () => { throw new Error("Aperçu : rien n'est envoyé."); }} videos={[]} onVideosChanged={() => {}} />;
}

// Objectifs du trimestre : « À travailler » tant que le coach n'a pas fait le point (le statut n'apparaît qu'après son évaluation)
function GoalsTab({ goals, stars }: { goals: Goal[]; stars: CourseStar[] | null }) {
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
                  {(() => { const earned = missionStars(stars ?? [], g.id, currentSeason(), t), target = g.targetStars ?? 10; return <><ProgressBar value={missionPercent(earned, target)} color={a.color} /><small className="font-bold">⭐ {earned} étoile{earned > 1 ? "s" : ""} sur {target} pour réussir cette mission</small></>; })()}
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

type FTab = "accueil" | "renseignements" | "objectifs" | "evaluations" | "etoiles" | "matchs" | "videos" | "compte";
const FTABS: [FTab, string][] = [["accueil", "🏠 Accueil"], ["renseignements", "📝 Renseignements"], ["objectifs", "🎯 Objectifs"], ["evaluations", "📊 Évaluations"], ["etoiles", "⭐ Étoiles"], ["matchs", "🏟️ Matchs"], ["videos", "🎬 Vidéos"], ["compte", "🔒 Compte"]];

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
            <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)] md:items-stretch md:gap-6">
            <div className="tabbar side">
              <div role="tablist" aria-label="Sections du suivi">
                {FTABS.map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={(e) => { go(k); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} className={"relative min-h-12 whitespace-nowrap border-b-4 px-4 font-bold transition-colors " + (tab === k ? "border-clay text-clay" : "border-transparent text-muted hover:text-ink")}>
                    <TabLabel text={label} />{k === "videos" && fresh.length > 0 && tab !== k && <span className="absolute right-1 top-2 h-3 w-3 rounded-full bg-clay" aria-label="Nouveau" />}
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
                  {infoMissing(p) > 0 && <button type="button" className="card grid gap-1 border-2 !border-clay text-left" onClick={() => go("renseignements")}><strong>📝 Merci de compléter la fiche de renseignements de {p.firstName}</strong><span className="text-sm text-muted">Club, licence, classement, disponibilités… Cela prend 2 minutes et aide le coach. Cliquez ici pour la remplir.</span></button>}
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
              {tab === "renseignements" && <FamilyInfo p={p} onSaved={(np) => setPlayers((all) => (all ?? []).map((x) => (x.id === np.id ? { ...x, ...np } : x)))} />}
              {tab === "objectifs" && <GoalsTab goals={list} stars={stars} />}
              {tab === "evaluations" && <EvalTab p={p} goals={list} />}
              {tab === "etoiles" && <><StarsRadar stars={stars} who="famille" /><StarsCard stars={stars} who="famille" /></>}
              {tab === "matchs" && <><FamilyTournaments /><MatchesTab p={p} /></>}
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
            </div>
          </>
        )}
      </Page>
    </>
  );
}
