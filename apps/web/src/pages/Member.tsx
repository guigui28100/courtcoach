import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get, post, put } from "../api";
import { useAuth } from "../auth";
import { ADULT_LEVELS, PARTNER_LEVELS_EXTRA, ProfCard, profName, fmtProfSlot, fmtSlot, courtNumber, workPhrase, Slot, todayIso, Lesson, VideoRow } from "../types";
import { BackLink, Empty, Err, Field, Page, PageHead, SideLayout, TabsBar } from "../components/ui";
import { useVideos, VideoList, VideoUpload } from "../components/Videos";
import { ProfChooser } from "../components/Profs";

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
const TYPE_UI: Record<string, [string, string, string]> = { individuel: ["🎾", "Cours individuel", "Sur le court, toi et ton coach"], duo: ["👥", "Cours à deux", "Avec un partenaire"] };
const GOALS = ["Coup droit", "Revers", "Service", "Retour de service", "Volée", "Smash", "Jeu de jambes", "Autre"];
const MOMENTS = ["Peu importe", "Matin", "Après-midi", "Soirée"];

// Pastille à cocher (choix unique ou multiple)
function Chip({ type, name, value, defaultChecked }: { type: "radio" | "checkbox"; name: string; value: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center rounded-full border-2 border-line bg-white px-4 font-semibold transition-colors hover:border-clay/50 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea] has-[:checked]:text-clay has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />{value}
    </label>
  );
}

function NewLessonForm({ preview, prof, price, onClose, onSent }: { preview: boolean; prof: ProfCard | null; price: number | null; onClose: () => void; onSent: () => void }) {
  const [err, setErr] = useState("");
  const [duo, setDuo] = useState(false); // cours à deux : on demande qui est le partenaire
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) { setErr("Aperçu : rien n'est envoyé. Un adulte verrait ici que sa demande est partie."); return; }
    const f = new FormData(e.currentTarget); setErr("");
    if (duo && (!String(f.get("pFirst") || "").trim() || !String(f.get("pLast") || "").trim() || !Number(f.get("pAge")) || !f.get("pLevel"))) { setErr("Pour un cours à deux, indique le prénom, le nom, l'âge et le classement (ou le niveau) de ton partenaire."); return; }
    try { await post("/lessons", { ...(prof ? { profId: prof.id } : {}), type: f.get("type"), objective: String(f.get("objective")), days: f.getAll("days"), moment: f.get("moment"), message: String(f.get("message") || "") || undefined, ...(duo ? { partnerFirstName: String(f.get("pFirst")), partnerLastName: String(f.get("pLast")), partnerAge: Number(f.get("pAge")), partnerLevel: String(f.get("pLevel")) } : {}) }); onClose(); onSent(); } catch (x) { setErr((x as Error).message); }
  }
  const legend = "mb-2 flex items-center gap-2 font-display text-base font-bold";
  const num = "grid h-7 w-7 place-items-center rounded-full bg-clay text-sm text-white";
  return (
    <form onSubmit={send} className="grid gap-6 rounded-3xl border-2 border-clay bg-white p-5 shadow-sm sm:p-6" noValidate aria-label="Nouvelle demande de cours">
      {prof ? (
        <div className="grid gap-1 rounded-2xl bg-sand p-3"><strong>👩‍🏫 Cours avec {profName(prof)}</strong>{price ? <span className="text-sm">💶 {price} € la séance, à régler directement avec {prof.firstName ?? "le professeur"}.</span> : null}{prof.slots.length > 0 && <span className="text-sm text-muted">Ses disponibilités : {prof.slots.map(fmtProfSlot).join(" · ")}</span>}</div>
      ) : <p className="m-0 rounded-2xl bg-sand p-3"><strong>🎾 Demande adressée au coach</strong></p>}
      <fieldset className="m-0 border-0 p-0" onChange={(e) => { const t = e.target as unknown as HTMLInputElement; if (t.name === "type") setDuo(t.value === "duo"); }}><legend className={legend}><span className={num}>1</span>Quel type de cours ?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(TYPE_UI).map(([k, [icon, title, sub]], i) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-white p-3 transition-colors hover:border-clay/50 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink">
              <input type="radio" name="type" value={k} defaultChecked={i === 0} className="sr-only" />
              <span aria-hidden="true" className="text-3xl">{icon}</span><span className="grid"><strong>{title}</strong><small className="text-muted">{sub}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      {duo && (
        <fieldset className="m-0 grid gap-3 rounded-2xl border-2 border-clay/40 bg-[#fdf1ea] p-4" aria-label="Ton partenaire">
          <legend className="px-2 font-display text-base font-bold">👥 Ton partenaire pour ce cours à deux</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Son prénom" id="p-first"><input id="p-first" name="pFirst" className="input" maxLength={60} autoComplete="off" required /></Field>
            <Field label="Son nom" id="p-last"><input id="p-last" name="pLast" className="input" maxLength={60} autoComplete="off" required /></Field>
            <Field label="Son âge" id="p-age"><input id="p-age" name="pAge" type="number" inputMode="numeric" min={4} max={99} className="input" required /></Field>
            <Field label="Son classement ou son niveau" id="p-level"><select id="p-level" name="pLevel" className="input" defaultValue="" required><option value="" disabled>Choisir…</option>{[...ADULT_LEVELS, PARTNER_LEVELS_EXTRA].map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
          <small className="text-muted">Ces informations servent seulement à organiser le cours : seuls ton professeur et le coach les voient. Préviens ton partenaire.</small>
        </fieldset>
      )}
      <fieldset className="m-0 border-0 p-0"><legend className={legend}><span className={num}>2</span>Sur quoi veux-tu travailler ?</legend>
        <div className="flex flex-wrap gap-2">{GOALS.map((g, i) => <Chip key={g} type="radio" name="objective" value={g} defaultChecked={i === 0} />)}</div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0"><legend className={legend}><span className={num}>3</span>Quels jours t'arrangent ? <small className="font-body font-normal text-muted">(facultatif)</small></legend>
        <div className="flex flex-wrap gap-2">{DAYS.map((d) => <Chip key={d} type="checkbox" name="days" value={d} />)}</div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0"><legend className={legend}><span className={num}>4</span>À quel moment de la journée ?</legend>
        <div className="flex flex-wrap gap-2">{MOMENTS.map((x, i) => <Chip key={x} type="radio" name="moment" value={x} defaultChecked={i === 0} />)}</div>
      </fieldset>
      <Field label={`Un message pour ${prof?.firstName ?? "ton coach"} (facultatif)`} id="message"><textarea id="message" name="message" className="input" maxLength={500} placeholder="Ex. : je voudrais fiabiliser mon service avant le tournoi" /></Field>
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
  const title = `${l.objective} · ${l.type === "duo" && l.partnerFirstName ? `À deux avec ${l.partnerFirstName}` : TYPE_SHORT[l.type] ?? "Cours"}${l.prof ? ` · avec ${l.prof.firstName ?? "ton professeur"}` : ""}${l.price ? ` · ${l.price} €` : ""}`;
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
        {l.status === "PENDING" && l.declinedSlot && <span className="text-sm text-muted">Tu n'étais pas disponible le {fmtSlot(l.declinedSlot)} : une autre date te sera proposée.</span>}
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
      <div className="grid gap-1 text-lg leading-snug">
        <p className="m-0">{l.prof ? (l.prof.firstName ?? "Ton professeur") : "Ton coach"} te propose un cours le <strong>{l.finalSlot ? fmtSlot(l.finalSlot) : ""}</strong>{l.place && courtNumber(l.place) ? <> sur le terrain n° <strong>{courtNumber(l.place)}</strong></> : ""}.</p>
        <p className="m-0">Objectif de la séance : <strong>{workPhrase(l.objective)}</strong></p>
      </div>
      {l.coachReply && <p className="m-0 text-sm">💬 « {l.coachReply} »</p>}
      {!no ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2"><button className="btn-clay" disabled={busy} onClick={() => reply("confirm")}>✅ Je confirme ce cours</button><button className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={() => setNo(true)}>Je ne suis pas disponible</button></div>
          <small>{l.prof ? (l.prof.firstName ?? "Ton professeur") : "Ton coach"} ne se déplacera que si tu confirmes.</small>
        </div>
      ) : (
        <div className="grid gap-2 text-ink">
          <input className="input !min-h-11" maxLength={200} aria-label="Message pour ton coach (facultatif)" placeholder="Un mot pour ton coach (facultatif)" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="flex flex-wrap gap-2"><button className="btn-danger" disabled={busy} onClick={() => reply("decline")}>Envoyer : pas disponible</button><button className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={() => setNo(false)}>Retour</button></div>
        </div>
      )}
      <Err msg={err} />
    </div>
  );
}

const COPY = { icon: "📅", title: "Mes cours particuliers", button: "+ Demander un cours", first: "Demander mon premier cours", none: "Tu n'as pas encore de cours particulier.", ok: "✅ Demande envoyée ! Ton professeur (et le coach) vont te répondre, tu la verras ici.", groups: ["✅ Mes cours confirmés", "⏳ En attente de réponse", "Demandes refusées"], emptyTitle: "Envie de progresser avec ton coach ?", emptyText: "Un cours particulier, c'est un vrai cours sur le court avec un professeur du club. Choisis ton professeur selon ses disponibilités, dis-lui sur quoi travailler : il te répond ici." };

function LessonsSection({ lessons, preview, seenLocal, onSent, onSeen, onRespond }: { lessons: Lesson[]; preview: boolean; seenLocal: string[]; onSent: () => void; onSeen: (l: Lesson) => void; onRespond: (l: Lesson, action: "confirm" | "decline", message?: string) => Promise<void> }) {
  const [step, setStep] = useState<null | "choose" | "form">(null); // choix du professeur, puis formulaire
  const [prof, setProf] = useState<ProfCard | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const open = step !== null;
  const [sent, setSent] = useState(false);
  const c = COPY;
  const isNew = (l: Lesson) => l.status !== "PENDING" && l.status !== "PROPOSED" && !l.seenByMemberAt && !seenLocal.includes(l.id);
  const stamp = (l: Lesson) => (l.finalSlot ? l.finalSlot.date + l.finalSlot.time : "9");
  const soonest = (a: Lesson, b: Lesson) => stamp(a).localeCompare(stamp(b)); // le prochain cours d'abord
  const latest = (a: Lesson, b: Lesson) => b.createdAt.localeCompare(a.createdAt);
  const toConfirm = lessons.filter((l) => l.status === "PROPOSED").sort(soonest);
  const confirmed = lessons.filter((l) => l.status === "ACCEPTED").sort(soonest);
  const upcoming = confirmed.filter((l) => !l.finalSlot || l.finalSlot.date >= todayIso()); // les cours passés ne sont plus affichés
  const next = upcoming.find((l) => l.finalSlot); const others = upcoming.filter((l) => l !== next);
  const waiting = lessons.filter((l) => l.status === "PENDING").sort(latest);
  const refused = lessons.filter((l) => l.status === "REFUSED").sort(latest);
  const folds = [{ title: "Cours annulés ou refusés", list: refused }].filter((g) => g.list.length > 0);
  // Un cours confirmé est visible tout de suite en haut : on le marque comme vu dès que l'adulte ouvre « Mes cours »
  const unseenConfirmed = confirmed.filter((l) => isNew(l)).map((l) => l.id).join(",");
  useEffect(() => { confirmed.filter((l) => isNew(l)).forEach(onSeen); }, [unseenConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = () => { setStep("choose"); setProf(null); setSent(false); };
  return (
    <section aria-labelledby="t-cours" className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="t-cours" className="m-0">{c.icon} {c.title}</h2>
        {!open && <button className="btn-clay" onClick={ask}>{c.button}</button>}
      </div>
      {sent && <p role="status" className="m-0 rounded-2xl border-2 border-ok bg-[#eef8f1] p-3 font-bold text-ok">{c.ok}</p>}
      {step === "choose" && <ProfChooser preview={preview} onClose={() => setStep(null)} onPick={(p, pr) => { setProf(p); setPrice(pr); setStep("form"); }} onNoPref={() => { setProf(null); setPrice(null); setStep("form"); }} />}
      {step === "form" && <NewLessonForm preview={preview} prof={prof} price={price} onClose={() => setStep(null)} onSent={() => { setSent(true); onSent(); }} />}
      {next && <NextCourse l={next} />}
      {toConfirm.map((l) => <ToConfirm key={l.id} l={l} onRespond={onRespond} />)}
      {others.length > 0 && <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-2xl bg-white p-0 ring-1 ring-line" aria-label="Mes autres cours confirmés">{others.map((l) => <LessonLine key={l.id} l={l} isNew={false} />)}</ul>}
      {waiting.length > 0 && (
        <div className="grid gap-2">
          <h3 className="m-0 font-display text-lg">⏳ Mes demandes en attente</h3>
          <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-2xl bg-white p-0 ring-1 ring-line">{waiting.map((l) => <LessonLine key={l.id} l={l} isNew={isNew(l)} />)}</ul>
        </div>
      )}
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
      await put("/auth/me/profile", { firstName: String(f.get("firstName") || ""), lastName: String(f.get("lastName") || ""), birthYear: Number(f.get("birthYear")) || undefined, level: String(f.get("level") || ""), phone: String(f.get("phone") || ""), clubMember: f.get("clubMember") === "on" });
      await reload(); setMsg({ ok: true, text: "Enregistré ✓" });
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  return (
    <section aria-labelledby="t-prof" className="card grid gap-3">
      <h2 id="t-prof" className="m-0 text-xl">🙋 Mon profil{missing && <span className="ml-2 rounded-full bg-[#fff3cd] px-3 py-0.5 align-middle text-sm font-bold text-[#7a5a00]">à compléter</span>}</h2>
      <p className="hint m-0">Ton professeur et ton coach voient ces informations (nom, âge, niveau, téléphone) sur tes demandes, pour préparer ton cours et te joindre. Tout est facultatif.</p>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" id="p-first"><input id="p-first" name="firstName" className="input" maxLength={60} defaultValue={preview ? "Marie" : me?.firstName ?? ""} /></Field>
          <Field label="Nom" id="p-last"><input id="p-last" name="lastName" className="input" maxLength={60} defaultValue={preview ? "Durand" : me?.lastName ?? ""} /></Field>
          <Field label="Année de naissance" id="p-year"><input id="p-year" name="birthYear" type="number" inputMode="numeric" min={1920} max={2030} className="input" defaultValue={preview ? 1985 : me?.birthYear ?? ""} /></Field>
          <Field label="Classement ou niveau" id="p-level"><select id="p-level" name="level" className="input" defaultValue={preview ? "30/2" : me?.level ?? ""}><option value="">Je ne sais pas</option>{ADULT_LEVELS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Téléphone" id="p-phone"><input id="p-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} className="input" placeholder="06 12 34 56 78" defaultValue={preview ? "06 12 34 56 78" : me?.phone ?? ""} /></Field>
        </div>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-white px-3 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]"><input type="checkbox" name="clubMember" className="h-5 w-5 accent-clay" defaultChecked={preview ? false : !!me?.clubMember} />Je suis adhérent du TC Houdan <small className="font-normal text-muted">(tarif des cours : 40 € au lieu de 50 €)</small></label>
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

// Espace de l'adulte : 3 rubriques (cours particuliers · coaching vidéo · profil)
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
            <BackLink fallback="/coach/adultes" className="btn-ink btn-sm no-underline">← Retour aux demandes</BackLink>
          </div>
        </div>
      )}
      <PageHead eyebrow="Mon espace" title={!preview && me?.firstName ? `Bonjour ${me.firstName} !` : "Bienvenue sur CourtCoach !"}>Tes cours particuliers, tes vidéos et ton profil, au même endroit.</PageHead>
      <Page>
        <SideLayout nav={<TabsBar label="Mon espace" active={tab} onChange={go} tabs={[["cours", "📅 Mes cours", newAnswers], ["videos", "🎬 Mon coaching vidéo", fresh.length], ["profil", "🙋 Mon profil", missing ? 1 : 0]]} />}>
          {tab === "cours" && <LessonsSection lessons={lessons} preview={preview} seenLocal={seenLocal} onSent={onLessonsChanged} onSeen={onSeen} onRespond={onRespond} />}

          {tab === "videos" && (
            <section aria-labelledby="t-vid" className="grid gap-5">
              <div className="grid gap-0.5"><h2 id="t-vid" className="m-0">🎬 Mon coaching vidéo</h2><p className="m-0 text-muted">Envoie une vidéo de quelques coups : ton coach la reçoit, l'analyse puis te la renvoie. Vous pouvez ensuite discuter ensemble, à partir de l'analyse, par messages.</p></div>
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
