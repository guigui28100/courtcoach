import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get, post, put } from "../api";
import { useAuth } from "../auth";
import { ADULT_LEVELS, PARTNER_LEVELS_EXTRA, PlanDay, ProfCard, profName, fmtProfSlot, fmtSlot, Slot, todayIso, Lesson, VideoRow, fmtDeadline, collapseSeries, everyDay, priceOn, MAX_AHEAD, aheadCount, lessonProfName } from "../types";
import { Avatar, BackLink, Empty, Err, Field, Page, PageHead, SideLayout, TabsBar } from "../components/ui";
import { useVideos, VideoList, VideoUpload } from "../components/Videos";
import { seriesDates } from "../series";
import { ClayHero, DAY_STEPS, fmtPlanSlot, PlanningPicker, previewPlanning, ProfChooser } from "../components/Profs";
import { CourseCalendar, DayHours, DaySheet, LessonSheet } from "../components/CourseCalendar";


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

// Pastille à cocher (choix unique ou multiple)
function Chip({ type, name, value, defaultChecked }: { type: "radio" | "checkbox"; name: string; value: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center rounded-full border-2 border-line bg-white px-4 font-semibold transition-colors hover:border-clay/50 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea] has-[:checked]:text-clay has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />{value}
    </label>
  );
}

type Recap = { when: string; prof: string; price: number | null };
function NewLessonForm({ preview, prof, date, price: basePrice, onClose, onBack, onSent }: { preview: boolean; prof: ProfCard | null; date?: string; onBack?: () => void; price: number | null; onClose: () => void; onSent: (booked?: boolean, info?: { seriesCount?: number; skipped?: { date: string; why: string }[] }, recap?: Recap) => void }) {
  const [err, setErr] = useState("");
  const [plan, setPlan] = useState<PlanDay[] | null>(prof ? null : []); // planning du professeur (créneaux d'une heure)
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const price = basePrice && slot ? priceOn(basePrice, slot.date) : basePrice; // +10 € le dimanche
  const loadPlan = useCallback(() => { if (!prof) return; if (preview) { setPlan(previewPlanning(prof.slots)); return; } get<{ days: PlanDay[] }>(`/profs/${prof.id}/planning`).then((r) => setPlan(r.days)).catch(() => setPlan([])); }, [prof, preview]);
  useEffect(loadPlan, [loadPlan]);
  const hasPlan = !!plan && plan.some((d) => (!date || d.date === date) && d.slots.some((s) => s.free)); // si un jour est déjà choisi : seulement les heures de ce jour
  const chosen = slot ? plan?.find((d) => d.date === slot.date)?.slots.find((s) => s.time === slot.time) : null;
  const [weekly, setWeekly] = useState(false); // « toute l'année » : le même créneau chaque semaine jusqu'au 30 juin
  const [duo, setDuo] = useState(false); // cours à deux : on demande qui est le partenaire
  const [sub, setSub] = useState<2 | 3>(2); // depuis un jour choisi : 2 = « Ton cours », 3 = « Heure » (les champs restent montés, seulement cachés)
  const step3 = !date || sub === 3;
  function next() {
    const f = new FormData(document.querySelector<HTMLFormElement>("form[aria-label='Nouvelle demande de cours']")!);
    if (duo && (!String(f.get("pFirst") || "").trim() || !String(f.get("pLast") || "").trim() || !Number(f.get("pAge")) || !f.get("pLevel"))) { setErr("Pour un cours à deux, indique le prénom, le nom, l'âge et le classement (ou le niveau) de ton partenaire."); return; }
    setErr(""); setSub(3); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) { setErr(slot ? "Aperçu : rien n'est réservé. Un adulte verrait ici « Réservé ! » et le créneau deviendrait indisponible pour les autres." : "Aperçu : rien n'est envoyé. Un adulte verrait ici que sa demande est partie."); return; }
    if (hasPlan && !slot) { setErr("Choisis un créneau dans le planning."); return; }
    const f = new FormData(e.currentTarget); setErr("");
    if (duo && (!String(f.get("pFirst") || "").trim() || !String(f.get("pLast") || "").trim() || !Number(f.get("pAge")) || !f.get("pLevel"))) { setErr("Pour un cours à deux, indique le prénom, le nom, l'âge et le classement (ou le niveau) de ton partenaire."); return; }
    try { const res = await post<{ seriesCount?: number; skipped?: { date: string; why: string }[] }>("/lessons", { ...(prof ? { profId: prof.id } : {}), ...(slot && hasPlan ? { slot, ...(weekly ? { weekly: true } : {}) } : {}), type: f.get("type"), objective: String(f.get("objective")), message: String(f.get("message") || "") || undefined, ...(duo ? { partnerFirstName: String(f.get("pFirst")), partnerLastName: String(f.get("pLast")), partnerAge: Number(f.get("pAge")), partnerLevel: String(f.get("pLevel")) } : {}) }); onClose(); onSent(!!(slot && hasPlan), res ?? undefined, slot && chosen ? { when: fmtPlanSlot(slot.date, chosen.time, chosen.end), prof: profName(prof), price } : undefined); } catch (x) { setErr((x as Error).message); if (slot) { setSlot(null); loadPlan(); } }
  }
  const cardCls = date ? "m-0 rounded-3xl border-2 border-line bg-white p-5 [&>legend]:float-left [&>legend]:w-full [&>legend+*]:clear-both" : "m-0 border-0 p-0"; // depuis un jour : une carte par question
  const legend = "mb-2 flex items-center gap-2 font-display text-base font-bold";
  const num = "grid h-7 w-7 place-items-center rounded-full bg-clay text-sm text-white";
  return (
    <form onSubmit={send} className="grid gap-6 rounded-3xl border-2 border-clay bg-white p-5 shadow-sm sm:p-6" noValidate aria-label="Nouvelle demande de cours">
      {date && <button type="button" className="justify-self-start border-0 bg-transparent p-0 text-sm font-bold text-ink underline" onClick={() => (sub === 3 ? setSub(2) : onBack?.())}>{sub === 3 ? "← Changer mon cours" : "← Changer de professeur"}</button>}
      {(hasPlan || (date && sub === 2 && plan !== null)) && <ClayHero labels={date ? DAY_STEPS : undefined} title={date ? (sub === 2 ? `Ton cours avec ${profName(prof)}` : "Choisis ton heure") : "Choisis ton créneau"} text={`${date ? `${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · ` : ""}${prof ? `Avec ${profName(prof)}` : "Cours particulier"} · cours d'1 heure${price ? ` · ${price} €${date && sub === 2 ? " la séance, à régler directement avec lui" : ""}` : ""}`} step={date && sub === 2 ? 2 : 3} />}
      {prof && date ? null : prof ? (
        <div className="grid gap-1 rounded-2xl bg-sand p-3"><strong>👩‍🏫 Cours avec {profName(prof)}</strong>{price ? <span className="text-sm">💶 {price} € la séance, à régler directement avec {prof.firstName ?? "le professeur"}.</span> : null}{prof.slots.length > 0 && <span className="text-sm text-muted">Ses disponibilités : {prof.slots.map(fmtProfSlot).join(" · ")}</span>}</div>
      ) : <p className="m-0 rounded-2xl bg-sand p-3"><strong>🎾 Demande adressée au coach</strong></p>}
      <div className={date && sub === 3 ? "hidden" : "grid gap-6"}>
      <fieldset className={cardCls} onChange={(e) => { const t = e.target as unknown as HTMLInputElement; if (t.name === "type") setDuo(t.value === "duo"); }}><legend className={legend}><span className={num}>1</span>Quel type de cours ?</legend>
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
      <fieldset className={cardCls}><legend className={legend}><span className={num}>2</span>Sur quoi veux-tu travailler ?</legend>
        <div className="flex flex-wrap gap-2">{GOALS.map((g, i) => <Chip key={g} type="radio" name="objective" value={g} defaultChecked={i === 0} />)}</div>
      </fieldset>
      </div>
      {date && sub === 2 && hasPlan && <div className="flex flex-wrap gap-2"><button type="button" className="btn-clay min-h-12" onClick={next}>Continuer : choisir l'heure →</button><button type="button" className="btn-outline" onClick={onClose}>Annuler</button></div>}
      {step3 && (hasPlan ? (
        <fieldset className={"m-0 grid gap-3 border-0 p-0 " + (date ? "mx-auto w-full max-w-[640px]" : "")}><legend className={legend}><span className={num}>3</span>{date ? "Choisis ton heure" : "Choisis ton créneau"} <small className="font-body font-normal text-muted">(1 heure)</small></legend>
          {date ? <DayHours day={plan!.find((d) => d.date === date)} value={slot} onChange={(v) => { setSlot(v); if (!v) setWeekly(false); }} /> : <PlanningPicker days={plan!} value={slot} onChange={(v) => { setSlot(v); if (!v) setWeekly(false); }} />}
          {slot && (() => { const all = seriesDates(slot.date); const kept = all.filter((d) => !d.skip).length; const vac = all.length - kept; return (
            <label className={"grid cursor-pointer gap-2 rounded-2xl border-2 p-4 " + (weekly ? "border-clay bg-[#fdf1ea] shadow-[0_5px_0_var(--color-clay)]" : "border-line bg-white")}>
              <span className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-clay" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /><span className="grid"><strong className="font-display text-lg">🔁 Je prends ce créneau toute l'année</strong><span className="text-sm text-muted">{everyDay(slot)}, jusqu'à la fin de la saison (30 juin).</span></span></span>
              {weekly && <span className="grid gap-1 text-sm"><span>👉 Jusqu'à <strong>{kept} cours</strong>{vac > 0 ? ` (${vac} semaine${vac > 1 ? "s" : ""} de vacances ou de jour férié sautée${vac > 1 ? "s" : ""})` : ""}{price ? ` · ${price} € le cours, réglé directement au professeur` : ""}.</span><span className="text-muted">Les dates où {prof?.firstName ?? "le professeur"} n'est pas disponible ou déjà pris sont sautées. Il confirme <strong>une seule fois</strong> pour toute la série. Tu pourras annuler un cours, ou toute la série, quand tu veux.</span></span>}
            </label>
          ); })()}
        </fieldset>
      ) : plan !== null ? (
        <p className="m-0 rounded-2xl bg-[#fff3cd] p-4 font-bold text-[#7a5a00]">📅 {prof ? profName(prof) : "Ce professeur"} n'a plus de créneau libre pour le moment. Reviens un peu plus tard, ou choisis un autre professeur.</p>
      ) : <div className="skeleton h-24" role="status" aria-label="Chargement du planning" />)}
      {date && sub === 2 && !hasPlan && plan !== null && <p className="m-0 rounded-2xl bg-[#fff3cd] p-4 font-bold text-[#7a5a00]">📅 Plus de créneau libre ce jour-là avec ce professeur. Change de professeur ou de jour.</p>}
      {step3 && hasPlan && <Field label={`Un message pour ${prof?.firstName ?? "ton professeur"} (facultatif)`} id="message"><textarea id="message" name="message" className="input" maxLength={500} placeholder="Ex. : je voudrais fiabiliser mon service avant le tournoi" /></Field>}
      <Err msg={err} />
      {step3 && hasPlan && <p className="m-0 text-sm text-muted">Ton créneau est mis de côté : personne d'autre ne peut le prendre. {prof?.firstName ?? "Le professeur"} doit le confirmer (sous 48 h, sinon il est libéré). Tu peux annuler depuis « Mes cours ».</p>}
      {date && hasPlan && chosen && slot && <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-ink p-4 text-white"><div className="grid"><strong className="text-lg">Ton créneau : {fmtPlanSlot(slot.date, chosen.time, chosen.end)}</strong><span className="text-sm text-white/80">avec {profName(prof)}{price ? ` · ${price} € à régler directement avec lui` : ""}{weekly ? " · 🔁 chaque semaine" : ""}</span></div></div>}
      {step3 && <div className="flex flex-wrap gap-2"><button className="btn-clay !h-auto min-h-12 max-w-full !whitespace-normal py-3 text-left" disabled={!hasPlan || !slot}>{chosen && slot ? (weekly ? `✅ Réserver : ${everyDay(slot)}` : `✅ Réserver : ${fmtPlanSlot(slot.date, chosen.time, chosen.end)}`) : "Choisis un créneau ci-dessus"}</button><button type="button" className="btn-outline" onClick={onClose}>Annuler</button></div>}
    </form>
  );
}

const TYPE_SHORT: Record<string, string> = { individuel: "Individuel", duo: "À deux" };
const MONTH_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Petite pastille de calendrier : le jour en gros, le mois en petit
function DateBadge({ slot, tone }: { slot: Slot; tone: "green" | "blue" | "amber" }) {
  const d = new Date(`${slot.date}T12:00:00`);
  return (
    <span aria-hidden="true" className={"grid h-14 w-14 shrink-0 place-items-center rounded-xl text-center leading-none " + (tone === "green" ? "bg-[#eef8f1] text-[#1d6b43]" : tone === "amber" ? "bg-[#fff3cd] text-[#7a5a00]" : "bg-[#eaf2fb] text-[#1f5a96]")}>
      <span className="grid"><small className="text-[0.7rem] font-bold uppercase">{MONTH_SHORT[d.getMonth()]}</small><strong className="font-display text-2xl">{d.getDate()}</strong></span>
    </span>
  );
}

// Une ligne par demande : l'essentiel seulement (sujet, date ou disponibilités, état)
function LessonLine({ l, isNew, onCancel }: { l: Lesson; isNew: boolean; onCancel?: (l: Lesson, series?: boolean) => void }) {
  const serie = (l.seriesCount ?? 0) > 1 && !!l.finalSlot; // série « toute l'année » : une seule ligne
  const title = `${serie ? "🔁 " : ""}${l.objective} · ${l.type === "duo" && l.partnerFirstName ? `À deux avec ${l.partnerFirstName}` : TYPE_SHORT[l.type] ?? "Cours"}${l.prof ? ` · avec ${lessonProfName(l.prof)}` : ""}${l.price ? ` · ${l.price} €` : ""}`;
  const state = { PENDING: ["Ancienne demande", "#4b5566"], BOOKED: ["⏳ Le professeur doit confirmer", "#7a5a00"], PROPOSED: ["Ancienne demande", "#4b5566"], ACCEPTED: ["✅ Confirmé", "#1d6b43"], REFUSED: ["❌ Refusée", "#9a2a1f"] }[l.status];
  const sub = serie ? `${everyDay(l.finalSlot!)} · ${l.seriesCount} cours${l.status === "REFUSED" ? " annulés" : " à venir"}${l.status === "BOOKED" ? ` · réponse attendue avant ${fmtDeadline(l.createdAt)}` : l.status === "ACCEPTED" ? ` · prochain : ${fmtSlot(l.finalSlot!)}` : ""}`
    : l.status === "BOOKED" && l.finalSlot ? `${fmtSlot(l.finalSlot)} · réponse attendue avant ${fmtDeadline(l.createdAt)}`
    : l.status === "ACCEPTED" && l.finalSlot ? `${fmtSlot(l.finalSlot)}${l.place ? ` · ${l.place}` : ""}`
    : l.status === "PENDING" ? `Tes disponibilités : ${l.days.length ? l.days.join(", ").toLowerCase() : "à définir"} · ${l.moment.toLowerCase()}`
    : l.coachReply ? `« ${l.coachReply} »` : "";
  return (
    <li className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[auto_1fr_auto]">
      {(l.status === "ACCEPTED" || l.status === "BOOKED") && l.finalSlot ? <DateBadge slot={l.finalSlot} tone={l.status === "BOOKED" ? "amber" : "green"} /> : <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-xl bg-sand text-2xl">{l.status === "PENDING" ? "⏳" : "🎾"}</span>}
      <div className="grid min-w-0 gap-0.5">
        <strong className="leading-tight">{title}{isNew && <span className="ml-2 rounded-full bg-clay px-2 py-0.5 align-middle text-xs font-bold text-white">nouveau</span>}</strong>
        {sub && <span className="text-sm text-muted">{sub}</span>}
        {l.status === "ACCEPTED" && l.coachReply && <span className="text-sm text-muted">💬 « {l.coachReply} »</span>}
        {l.status === "PENDING" && l.declinedSlot && <span className="text-sm text-muted">Tu n'étais pas disponible le {fmtSlot(l.declinedSlot)} : une autre date te sera proposée.</span>}
      </div>
      <span className="col-span-2 grid justify-items-start gap-1 text-sm font-bold sm:col-span-1 sm:justify-items-end" style={{ color: state[1] }}>{state[0]}{onCancel && (l.status === "ACCEPTED" || l.status === "PENDING" || l.status === "BOOKED") && <button className="text-xs font-bold text-[#9a2a1f] underline" onClick={() => onCancel(l, serie && l.status === "BOOKED")}>{l.status !== "ACCEPTED" ? (serie ? "Retirer la série" : "Retirer ma demande") : serie ? "Annuler le prochain cours" : "Annuler ce cours"}</button>}{onCancel && serie && l.status === "ACCEPTED" && <button className="text-xs font-bold text-[#9a2a1f] underline" onClick={() => onCancel(l, true)}>Arrêter la série</button>}</span>
    </li>
  );
}

// Grand encadré : le prochain cours confirmé
function NextCourse({ l, onCancel }: { l: Lesson; onCancel?: (l: Lesson, series?: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-[#1d6b43] p-5 text-white shadow-sm">
      <DateBadge slot={l.finalSlot!} tone="green" />
      <div className="grid min-w-0 gap-0.5">
        <small className="font-bold uppercase tracking-wide text-white/80">Ton prochain cours</small>
        <strong className="font-display text-2xl leading-tight">{fmtSlot(l.finalSlot!)}</strong>
        {(l.seriesCount ?? 0) > 1 && <span className="font-bold text-ball">🔁 Série : {everyDay(l.finalSlot!)} · {l.seriesCount} cours à venir</span>}
        <span className="text-white/90">{l.objective} · {TYPE_SHORT[l.type] ?? "Cours"}{l.prof ? ` · avec ${lessonProfName(l.prof)}` : ""}{l.place ? ` · ${l.place}` : ""}</span>
      </div>
      {onCancel && <div className="ml-auto grid gap-2"><button className="rounded-full border-2 border-white/60 px-4 py-1.5 text-sm font-bold text-white hover:bg-white hover:text-[#1d6b43]" onClick={() => onCancel(l)}>Annuler ce cours</button>{(l.seriesCount ?? 0) > 1 && <button className="rounded-full border-2 border-white/60 px-4 py-1.5 text-sm font-bold text-white hover:bg-white hover:text-[#1d6b43]" onClick={() => onCancel(l, true)}>Arrêter la série</button>}</div>}
    </div>
  );
}

const COPY = { icon: "📅", title: "Mes cours particuliers", button: "+ Demander un cours", first: "Demander mon premier cours", none: "Tu n'as pas encore de cours particulier.", ok: "✅ Demande envoyée ! Ton professeur (et le coach) vont te répondre, tu la verras ici.", groups: ["✅ Mes cours confirmés", "⏳ En attente de réponse", "Demandes refusées"], emptyTitle: "Envie de progresser avec ton coach ?", emptyText: "Un cours particulier, c'est un vrai cours sur le court avec un professeur du club. Choisis ton professeur selon ses disponibilités, dis-lui sur quoi travailler : il te répond ici." };

function LessonsSection({ lessons, preview, seenLocal, onSent, onSeen }: { lessons: Lesson[]; preview: boolean; seenLocal: string[]; onSent: () => void; onSeen: (l: Lesson) => void }) {
  const [step, setStep] = useState<null | "choose" | "form">(null); // choix du professeur, puis formulaire
  const [prof, setProf] = useState<ProfCard | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [askDate, setAskDate] = useState<string | undefined>(undefined); // jour choisi dans le calendrier
  const [sheet, setSheet] = useState<{ lesson: Lesson } | { day: string } | null>(null);
  const open = step !== null;
  const full = aheadCount(lessons) >= MAX_AHEAD; // déjà 2 cours réservés à venir : pas de nouvelle réservation
  const [sent, setSent] = useState<false | "request" | "booked">(false);
  const [serieInfo, setSerieInfo] = useState<{ count: number; skipped: { date: string; why: string }[] } | null>(null);
  const [cancelErr, setCancelErr] = useState("");
  const c = COPY;
  async function cancel(l: Lesson, series = false) {
    setCancelErr("");
    if (preview) { setCancelErr("Aperçu : rien n'est annulé. Un adulte verrait ici le cours disparaître et le créneau redevenir libre."); return; }
    if (!confirm(series ? "Arrêter toute la série ? Tous les cours à venir sont annulés, les créneaux redeviennent libres et le professeur est prévenu." : "Annuler ce cours ? Le créneau redevient libre et le professeur est prévenu.")) return;
    try { await post(`/lessons/${l.id}/cancel`, series ? { series: true } : {}); onSent(); } catch (x) { setCancelErr((x as Error).message); }
  }
  const isNew = (l: Lesson) => l.status !== "PENDING" && l.status !== "PROPOSED" && l.status !== "BOOKED" && !l.seenByMemberAt && !seenLocal.includes(l.id);
  const stamp = (l: Lesson) => (l.finalSlot ? l.finalSlot.date + l.finalSlot.time : "9");
  const soonest = (a: Lesson, b: Lesson) => stamp(a).localeCompare(stamp(b)); // le prochain cours d'abord
  const latest = (a: Lesson, b: Lesson) => b.createdAt.localeCompare(a.createdAt);
  const confirmed = lessons.filter((l) => l.status === "ACCEPTED").sort(soonest);
  const upcoming = confirmed.filter((l) => !l.finalSlot || l.finalSlot.date >= todayIso()); // les cours passés ne sont plus affichés
  const next0 = upcoming.find((l) => l.finalSlot); const next = next0 && next0.seriesId ? { ...next0, seriesCount: upcoming.filter((r) => r.seriesId === next0.seriesId).length } : next0;
  const others = collapseSeries(upcoming.filter((l) => l !== next0 && !(next0?.seriesId && l.seriesId === next0.seriesId)));
  const awaiting = lessons.filter((l) => l.status === "BOOKED").sort(soonest); // réservés, le professeur doit confirmer
  const waiting = collapseSeries([...awaiting, ...lessons.filter((l) => l.status === "PENDING").sort(latest)]);
  const refused = lessons.filter((l) => l.status === "REFUSED").sort(latest);
  const past = confirmed.filter((l) => l.finalSlot && l.finalSlot.date < todayIso()).sort((a, b) => stamp(b).localeCompare(stamp(a)));
  const tabs = [{ k: "venir", title: "À venir", list: others }, { k: "attente", title: "⏳ En attente", list: waiting }, { k: "passes", title: "Passés et annulés", list: collapseSeries([...refused, ...past]) }];
  const [tab, setTab] = useState<string | null>(null);
  const shownTab = tabs.find((t) => t.k === tab) ?? (others.length || !waiting.length ? tabs[0] : tabs[1]);
  // Un cours confirmé est visible tout de suite en haut : on le marque comme vu dès que l'adulte ouvre « Mes cours »
  const unseenConfirmed = confirmed.filter((l) => isNew(l)).map((l) => l.id).join(",");
  useEffect(() => { confirmed.filter((l) => isNew(l)).forEach(onSeen); }, [unseenConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = (date?: string) => { setAskDate(date); setStep("choose"); setProf(null); setSent(false); setSerieInfo(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <section aria-labelledby="t-cours" className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="t-cours" className="m-0">{c.icon} {c.title}</h2>
        {!open && <button className="btn-clay disabled:cursor-not-allowed disabled:opacity-50" disabled={full} onClick={() => ask()}>{c.button}</button>}
      </div>
      {sent === "booked" && recap && !serieInfo && (
        <div role="status" className="grid gap-2 rounded-3xl border-2 border-ok bg-[#e8f7ee] p-6 text-center"><strong className="font-display text-3xl text-[#166534]">🎉 C'est réservé !</strong><span className="text-lg font-bold">{recap.when} · avec {recap.prof}{recap.price ? ` · ${recap.price} €` : ""}</span><span className="font-bold text-[#14532d]">⏳ Il ne reste qu'à attendre la confirmation du professeur (48 h maximum). Tu la verras dans ton calendrier : l'étiquette passera du jaune au vert.</span><span><button className="btn-outline btn-sm" onClick={() => setSent(false)}>Voir mon calendrier</button></span></div>
      )}
      {sent && !(sent === "booked" && recap && !serieInfo) && <p role="status" className="m-0 rounded-2xl border-2 border-ok bg-[#eef8f1] p-3 font-bold text-ok">{sent === "booked" && serieInfo ? <>✅ Série réservée : {serieInfo.count} cours ! Ton professeur doit la confirmer une seule fois (sous 48 h). Tu la vois dans « En attente ».{serieInfo.skipped.length > 0 && <details className="mt-1 font-normal"><summary className="cursor-pointer font-bold">{serieInfo.skipped.length} date{serieInfo.skipped.length > 1 ? "s" : ""} sautée{serieInfo.skipped.length > 1 ? "s" : ""} (vacances, jours fériés…)</summary><ul className="m-0 mt-1 grid list-none gap-0.5 p-0 text-sm">{serieInfo.skipped.map((s) => <li key={s.date}>{new Date(`${s.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : {s.why}</li>)}</ul></details>}</> : sent === "booked" ? "✅ Créneau réservé ! Il est mis de côté pour toi : ton professeur doit le confirmer (sous 48 h). Tu le vois dans « En attente »." : c.ok}</p>}
      {full && !open && <p role="status" className="m-0 rounded-2xl border-2 border-[#e0b84a] bg-[#fff3cd] p-3 font-bold text-[#7a5a00]">🔒 Tu as déjà {MAX_AHEAD} cours réservés à venir. Pour en réserver un autre, attends qu'un cours ait eu lieu ou annule-en un (touche-le dans le calendrier).</p>}
      <Err msg={cancelErr} />
      {step === "choose" && <ProfChooser preview={preview} date={askDate} onClose={() => setStep(null)} onPick={(p, pr) => { setProf(p); setPrice(pr); setStep("form"); }} />}
      {step === "form" && <NewLessonForm preview={preview} prof={prof} date={askDate} price={price} onBack={() => setStep("choose")} onClose={() => setStep(null)} onSent={(booked, info, rc) => { setRecap(rc ?? null); setSent(booked ? "booked" : "request"); setSerieInfo(info?.seriesCount ? { count: info.seriesCount, skipped: info.skipped ?? [] } : null); onSent(); }} />}
      {next && <NextCourse l={next} onCancel={cancel} />}
      {!open && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 font-display text-xl">Mes cours à venir</h3>
          </div>
          {!full && <div className="grid gap-2 rounded-2xl bg-[#eef2fb] p-3 text-[#1b1863] sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center sm:gap-3" role="note" aria-label="Deux façons de réserver"><strong className="text-sm">Deux façons de réserver :</strong><span className="rounded-xl bg-white px-3 py-2 text-sm font-bold"><span aria-hidden="true">① 📆 </span>Touche un jour libre du calendrier (marqué <span aria-hidden="true">＋</span>)</span><span aria-hidden="true" className="text-center text-sm font-bold">ou</span><span className="rounded-xl bg-white px-3 py-2 text-sm font-bold"><span aria-hidden="true">② 🔘 </span>Utilise le bouton « {c.button} » en haut</span></div>}
          {<CourseCalendar preview={preview} locked={full} lessons={lessons} onLesson={(l) => setSheet({ lesson: l })} onDay={(d) => setSheet({ day: d })} />}
          {<ol className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-3">{["Choisis ton professeur", "Touche un créneau libre", "Le professeur confirme : c'est réservé"].map((t, i) => <li key={t} className="flex items-center gap-3 rounded-2xl bg-[#eef3fb] p-3 text-sm font-bold"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-white">{i + 1}</span>{t}</li>)}</ol>}
        </div>
      )}
      {sheet && "lesson" in sheet && <LessonSheet l={sheet.lesson} onClose={() => setSheet(null)} onCancel={cancel} />}
      {sheet && "day" in sheet && <DaySheet date={sheet.day} preview={preview} onClose={() => setSheet(null)} onReserve={() => { const d = sheet.day; setSheet(null); ask(d); }} />}
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
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-white px-3 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]"><input type="checkbox" name="clubMember" className="h-5 w-5 accent-clay" defaultChecked={preview ? false : !!me?.clubMember} />Je suis adhérent du TC Houdan <small className="font-normal text-muted">(tarif des cours : 40 € au lieu de 50 €, +10 € le dimanche)</small></label>
        <div className="flex flex-wrap items-center gap-3"><button className="btn-clay">Enregistrer</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
      </form>
    </section>
  );
}

// Espace de l'adhérent adulte : demandes de cours et réponse du coach, visibles tout de suite.
// Exemples FICTIFS montrés au coach dans « Voir comme un adulte » (aucune vraie demande, aucune donnée de personne)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const EXAMPLE_LESSONS: Lesson[] = [
  { id: "ex1", type: "individuel", objective: "Service", days: ["Mardi", "Jeudi"], moment: "Soirée", message: "", status: "ACCEPTED", finalSlot: { date: inDays(4), time: "18:00" }, place: "Court 2", confirmedAt: "2026-10-05T12:00:00Z", coachReply: "Parfait, à mardi !", answeredAt: "2026-10-05T10:00:00Z", seenByMemberAt: "2026-10-05T12:00:00Z", createdAt: "2026-10-03T09:00:00Z", prof: { id: "ex-p1", firstName: "Guillaume", lastName: "Exemple" } },
  { id: "ex5", type: "individuel", objective: "Volée", days: ["Mercredi"], moment: "Soirée", message: "", status: "BOOKED", finalSlot: { date: inDays(10), time: "19:00" }, price: 40, prof: { id: "ex-1", firstName: "Guillaume", lastName: "Exemple" }, coachReply: "", answeredAt: null, seenByMemberAt: "2026-10-09T09:00:00Z", createdAt: new Date().toISOString() },
  { id: "ex4", type: "duo", objective: "Volée", days: ["Samedi"], moment: "Matin", message: "", status: "REFUSED", coachReply: "Pas de place ce mois-ci, on regarde en novembre.", answeredAt: "2026-10-04T10:00:00Z", seenByMemberAt: "2026-10-04T12:00:00Z", createdAt: "2026-10-02T09:00:00Z" },
];

type AdultTab = "cours" | "videos" | "profil";

// Espace de l'adulte : 3 rubriques (cours particuliers · coaching vidéo · profil)
function AdultView({ preview, lessons, seenLocal, onLessonsChanged, onSeen, videos, onVideosChanged }: {
  preview: boolean; lessons: Lesson[]; seenLocal: string[]; onLessonsChanged: () => void; onSeen: (l: Lesson) => void; videos: VideoRow[] | null; onVideosChanged: () => void;
}) {
  const { me, eraseAccount } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: AdultTab = (["cours", "videos", "profil"] as const).find((k) => k === params.get("onglet")) ?? "cours";
  const go = (k: string) => { setParams(k === "cours" ? {} : { onglet: k }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const unseen = (l: Lesson) => (l.status !== "PENDING" && l.status !== "PROPOSED" && l.status !== "BOOKED" && !l.seenByMemberAt && !seenLocal.includes(l.id));
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
            <BackLink fallback={me?.role === "PRESIDENT" ? "/president" : "/coach/adultes"} className="btn-ink btn-sm no-underline">{me?.role === "PRESIDENT" ? "← Retour" : "← Retour aux demandes"}</BackLink>
          </div>
        </div>
      )}
      <PageHead eyebrow="Mon espace" title={!preview && me?.firstName ? `Bonjour ${me.firstName} !` : "Bienvenue sur CourtCoach !"}>Tes cours particuliers, tes vidéos et ton profil, au même endroit.</PageHead>
      <Page>
        <SideLayout nav={<TabsBar label="Mon espace" active={tab} onChange={go} tabs={[["cours", "📅 Mes cours", newAnswers], ["videos", "🎬 Mon coaching vidéo", fresh.length], ["profil", "🙋 Mon profil", missing ? 1 : 0]]} />}>
          {tab === "cours" && <LessonsSection lessons={lessons} preview={preview} seenLocal={seenLocal} onSent={onLessonsChanged} onSeen={onSeen} />}

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
  return <AdultView preview={false} lessons={lessons} seenLocal={[]} onLessonsChanged={load} onSeen={async (l) => { await post(`/lessons/${l.id}/seen`); load(); }} videos={videos} onVideosChanged={refresh} />;
}

// Aperçu du coach : exemples inventés, aucun appel au serveur
export function AdultPreview() {
  const [seen, setSeen] = useState<string[]>([]);
  const [mode, setMode] = useState<"vide" | "deux">("vide"); // adulte sans réservation (pour tester) ou adulte qui a déjà 2 cours
  return <><div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[#fff3cd] p-3 text-sm font-bold text-[#7a5a00]" role="group" aria-label="Exemple d'adulte"><span>👀 Exemple d'adulte :</span>{([["vide", "Sans aucune réservation (pour tester)"], ["deux", "Qui a déjà 2 cours (limite atteinte)"]] as const).map(([k, t]) => <button key={k} type="button" aria-pressed={mode === k} className={"rounded-full border-2 px-3 py-1 " + (mode === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")} onClick={() => setMode(k)}>{t}</button>)}</div><AdultView preview lessons={mode === "vide" ? [] : EXAMPLE_LESSONS} seenLocal={seen} onLessonsChanged={() => {}} onSeen={(l) => setSeen((s) => [...s, l.id])} videos={[]} onVideosChanged={() => {}} /></>;
}
