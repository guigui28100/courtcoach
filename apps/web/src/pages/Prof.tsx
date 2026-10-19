import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { setPreviewOnly } from "../api";
import { api, del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { PROF_LEVELS, PriceNote, ProfCardView } from "../components/Profs";
import { Empty, Err, Field, Page, PageHead, SideLayout, TabsBar } from "../components/ui";
import { collapseSeries, DOC_KINDS, fmtDate, fmtProfSlot, Lesson, PRICE_MEMBER, PRICE_OTHER, ProfCard, ProfMe, ProfMeResp, ProfSlot, STATUS_TEXT, WEEKDAYS } from "../types";
import { LessonRow } from "./Coach";
import { BackLink } from "../components/ui";

type Tab = "demandes" | "dispos" | "presentation" | "documents";
const TABS: Tab[] = ["demandes", "dispos", "presentation", "documents"];
const HOURS = Array.from({ length: 29 }, (_, i) => { const m = 7 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`; }); // 07:00 → 21:00
const hourLabel = (t: string) => t.replace(":00", " h").replace(":30", " h 30");

// Exemples INVENTÉS pour « Voir comme un professeur » (le coach ne voit aucune vraie fiche ; rien n'est enregistré)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const EXAMPLE_ME: ProfMe = { firstName: "Claire", lastName: "Exemple", birthYear: 1992, showAge: true, ranking: "15/1", bestRanking: "4/6", bio: "Je suis à l'aise avec les débutants et la remise en route.", paused: false, status: "waiting", approved: false, slots: [{ weekday: 1, date: null, start: "18:00", end: "20:00" }, { weekday: 5, date: null, start: "09:00", end: "12:00" }, { weekday: null, date: inDays(9), start: "14:00", end: "16:00" }], documents: [{ kind: "DIPLOME", fileName: "diplome.pdf", sizeBytes: 1000, validUntil: null, uploadedAt: new Date().toISOString() }, { kind: "AUTO_ENTREPRENEUR", fileName: "attestation.pdf", sizeBytes: 1000, validUntil: null, uploadedAt: new Date().toISOString() }, { kind: "CARTE_PRO", fileName: "carte.pdf", sizeBytes: 1000, validUntil: inDays(300) + "T00:00:00.000Z", uploadedAt: new Date().toISOString() }], prices: { member: PRICE_MEMBER, other: PRICE_OTHER } };
const EXAMPLE_LESSONS: Lesson[] = [
  { id: "ex1", type: "individuel", objective: "Service", days: ["Mardi"], moment: "Soirée", message: "Je voudrais fiabiliser mon service avant le tournoi.", status: "ACCEPTED", finalSlot: { date: inDays(2), time: "18:00" }, confirmedAt: new Date().toISOString(), coachReply: "", answeredAt: new Date().toISOString(), seenByMemberAt: new Date().toISOString(), createdAt: new Date().toISOString(), price: 40, memberDeclared: true, member: { id: "m1", firstName: "Marie", lastName: "Exemple", birthYear: 1985, level: "30/2", phone: "06 12 34 56 78" } },
  { id: "ex4", type: "individuel", objective: "Volée", days: ["Mercredi"], moment: "Soirée", message: "", status: "BOOKED", finalSlot: { date: inDays(3), time: "19:00" }, coachReply: "", answeredAt: null, seenByMemberAt: new Date().toISOString(), createdAt: new Date().toISOString(), price: 50, memberDeclared: false, member: { id: "m2", firstName: "Marc", lastName: "Exemple", birthYear: 1973, level: "30/1", phone: "06 98 76 54 32" } },
  { id: "ex2", type: "duo", objective: "Revers", days: ["Samedi"], moment: "Matin", message: "", status: "ACCEPTED", finalSlot: { date: inDays(6), time: "10:00" }, confirmedAt: new Date().toISOString(), partnerFirstName: "Paul", partnerLastName: "Exemple", partnerAge: 40, partnerLevel: "30", coachReply: "", answeredAt: new Date().toISOString(), seenByMemberAt: new Date().toISOString(), createdAt: new Date().toISOString(), price: 50, memberDeclared: false, member: { id: "m2", firstName: "Luc", lastName: "Exemple", birthYear: 1979, level: "15/4", phone: "06 98 76 54 32" } },
  { id: "ex3", type: "individuel", objective: "Smash", days: ["Mercredi"], moment: "Après-midi", message: "Plus aucun créneau libre : peux-tu me proposer une date ?", status: "PENDING", coachReply: "", answeredAt: null, seenByMemberAt: null, createdAt: new Date().toISOString(), price: 40, memberDeclared: true, member: { id: "m3", firstName: "Anne", lastName: "Exemple", birthYear: 1990, level: "30", phone: "06 11 22 33 44" } },
];

// Cours particuliers pour un entraîneur : il clique « je souhaite donner des cours particuliers », puis remplit sa présentation, ses disponibilités et ses documents
export function ProfSpace({ preview = false }: { preview?: boolean }) {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((k) => k === params.get("onglet")) ?? "demandes";
  const [resp, setResp] = useState<ProfMeResp | null>(preview ? { ...EXAMPLE_ME, optedIn: true } : null);
  const [lessons, setLessons] = useState<Lesson[] | null>(preview ? EXAMPLE_LESSONS : null);
  useEffect(() => { if (!preview) return; setPreviewOnly(true); return () => setPreviewOnly(false); }, [preview]); // aperçu : aucune écriture
  const [err, setErr] = useState("");
  const loadLessons = useCallback(() => { if (preview) return; get<Lesson[]>("/lessons").then(setLessons).catch(() => setLessons([])); }, []);
  const load = useCallback(() => { if (preview) return; get<ProfMeResp>("/profs/me").then((r) => { setResp(r); if (r.optedIn) loadLessons(); }).catch((e) => setErr((e as Error).message)); }, [loadLessons, preview]);
  useEffect(load, [load]);
  const p = resp && resp.optedIn ? resp : null;
  const setP = (x: ProfMe) => setResp({ ...x, optedIn: true });
  async function optIn() { if (preview) { setResp({ ...EXAMPLE_ME, optedIn: true }); setLessons(EXAMPLE_LESSONS); setParams({ onglet: "presentation" }); return; } setErr(""); try { setResp(await post<ProfMeResp>("/profs/me/optin")); loadLessons(); setParams({ onglet: "presentation" }); } catch (x) { setErr((x as Error).message); } }
  async function optOut() {
    const today = new Date().toISOString().slice(0, 10);
    const n = (lessons ?? []).filter((l) => ["BOOKED", "PROPOSED", "ACCEPTED"].includes(l.status) && (!l.finalSlot || l.finalSlot.date >= today)).length;
    if (!confirm(`Arrêter les cours particuliers ?\n\n• ${n > 0 ? `Tes ${n} cours à venir (séries comprises) seront ANNULÉS, les créneaux libérés et les adultes prévenus.` : "Tu n'as aucun cours à venir."}\n• Ta présentation, tes disponibilités et tes documents seront effacés : si tu recommences, il faudra tout ressaisir et le coach devra te revalider.\n\nPour une simple coupure, utilise plutôt la « Pause » (dans « Mes disponibilités »).`)) return;
    if (preview) { setResp({ optedIn: false, prices: { member: PRICE_MEMBER, other: PRICE_OTHER } }); setLessons(null); return; }
    try { setResp(await del<ProfMeResp>("/profs/me")); setLessons(null); } catch (x) { setErr((x as Error).message); }
  }
  const todo = (lessons ?? []).filter((l) => l.status === "PENDING" || l.status === "BOOKED").length;
  const missing = p ? p.status === "missing" || p.status === "expired" : false;
  const go = (k: string) => { setParams(k === "demandes" ? {} : { onglet: k }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const st = p ? STATUS_TEXT[p.status] : null;
  return (
    <>
      {preview && (
        <div role="note" className="border-b-4 border-[#c08a00] bg-[#fff3cd] px-4 py-3 text-[#5c4300]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="m-0"><strong>👀 Aperçu : voici ce que voit un entraîneur qui donne des cours particuliers.</strong> Fiche, demandes et documents sont des exemples inventés, rien n'est enregistré. Essaie le bouton « Je souhaite donner des cours » puis « Arrêter ».</p>
            <BackLink fallback="/coach/adultes" className="btn-ink btn-sm no-underline">← Retour</BackLink>
          </div>
        </div>
      )}
      <PageHead eyebrow="Cours particuliers" title={preview ? "Bonjour Claire !" : me?.firstName ? `Bonjour ${me.firstName} !` : "Bonjour !"}>Donne des cours particuliers aux adultes du club : tes cours réservés, tes disponibilités et ta présentation, au même endroit.</PageHead>
      <Page>
        <Err msg={err} />
        {resp && !resp.optedIn && (
          <section className="card grid gap-4 border-2 !border-clay" aria-labelledby="po-h">
            <h2 id="po-h" className="m-0 text-xl">🎾 Tu souhaites donner des cours particuliers ?</h2>
            <p className="m-0">Les adultes du club peuvent choisir un professeur et lui demander un cours. Si tu es d'accord, voici comment ça marche :</p>
            <ol className="m-0 grid gap-1 pl-5">
              <li>Tu remplis ta <strong>présentation</strong> (nom, classement, meilleur classement…) et tes <strong>disponibilités</strong>.</li>
              <li>Tu déposes tes <strong>3 documents</strong> : carte professionnelle, diplôme, déclaration d'auto-entrepreneur (seul le coach les voit).</li>
              <li>Le coach vérifie et te rend <strong>visible</strong> des adultes.</li>
              <li>Les adultes réservent eux-mêmes un créneau libre dans ton planning : le créneau est mis de côté et tu le confirmes (sous 48 h). Tarif : {PRICE_MEMBER} € la séance pour un adhérent du TC Houdan, {PRICE_OTHER} € pour les autres, réglés directement avec toi.</li>
            </ol>
            <p className="hint m-0">Tu peux arrêter quand tu veux : tout ce que tu as déposé est alors effacé.</p>
            <div><button className="btn-clay" onClick={optIn}>✋ Je souhaite donner des cours particuliers</button></div>
          </section>
        )}
        {st && <p role="status" className={"m-0 rounded-2xl border-2 p-3 font-bold " + (st[1] === "ok" ? "border-ok bg-[#eef8f1] text-ok" : st[1] === "bad" ? "border-bad bg-[#fdf0ee] text-bad" : "border-[#c08a00] bg-[#fff8e1] text-[#7a5a00]")}>{st[0]}</p>}
        {p && (
          <SideLayout nav={<TabsBar label="Mes cours particuliers" active={tab} onChange={go} tabs={[["demandes", "📅 Mes cours", todo], ["dispos", "📅 Mes disponibilités"], ["presentation", "🙋 Ma présentation"], ["documents", "📎 Mes documents", missing ? 1 : 0]]} />}>
            {tab === "demandes" && <Requests lessons={lessons} reload={loadLessons} />}
            {tab === "dispos" && <Availability p={p} onSaved={setP} />}
            {tab === "presentation" && <><Presentation p={p} onSaved={setP} /><div className="card grid gap-2 border-dashed"><strong>Arrêter les cours particuliers</strong><p className="m-0 text-sm text-muted">Tes cours à venir sont annulés (les adultes sont prévenus), ta fiche, tes disponibilités et tes documents sont effacés. Tu pourras recommencer plus tard, mais il faudra tout ressaisir et le coach devra te revalider. Pour une simple coupure, utilise la « Pause » dans « Mes disponibilités ».</p><div><button className="btn-danger btn-sm" onClick={optOut}>Arrêter les cours particuliers</button></div></div></>}
            {tab === "documents" && <Documents p={p} id={me?.id ?? ""} onChanged={setP} />}
          </SideLayout>
        )}
        {!resp && !err && <div className="skeleton h-40" role="status" aria-label="Chargement en cours" />}
      </Page>
    </>
  );
}

function Requests({ lessons, reload }: { lessons: Lesson[] | null; reload: () => void }) {
  if (!lessons) return <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const byDate = (a: Lesson, b: Lesson) => ((a.finalSlot?.date ?? "9") + (a.finalSlot?.time ?? "")).localeCompare((b.finalSlot?.date ?? "9") + (b.finalSlot?.time ?? ""));
  const today = new Date().toISOString().slice(0, 10);
  const booked = collapseSeries(lessons.filter((l) => l.status === "ACCEPTED" && (!l.finalSlot || l.finalSlot.date >= today))).sort(byDate);
  const group = (title: string, hint: string | null, list: Lesson[]) => list.length > 0 && <section className="grid gap-2"><h3 className="m-0 text-lg">{title} ({list.length})</h3>{hint && <p className="hint m-0">{hint}</p>}<ul className="m-0 grid list-none gap-3 p-0">{list.map((l) => <LessonRow key={l.id} l={l} onDone={reload} asProf />)}</ul></section>;
  return (
    <section className="grid gap-5" aria-labelledby="pr-h">
      <div className="grid gap-1"><h2 id="pr-h" className="m-0">📅 Mes cours particuliers</h2><p className="m-0 text-muted">Les adultes choisissent <strong>eux-mêmes</strong> un créneau libre dans ton planning. Le créneau est mis de côté, et c'est <strong>à toi de le confirmer</strong> (sous 48 h : sans réponse, il est libéré).</p></div>
      <div className="grid grid-cols-3 gap-3 rounded-2xl border-2 border-line bg-white p-4 text-center" aria-label="Résumé">
        <div><b className="block font-display text-3xl font-black text-clay">{lessons.filter((l) => l.status === "ACCEPTED" && (!l.finalSlot || l.finalSlot.date >= today)).length}</b><small className="text-muted">cours à venir</small></div>
        <div><b className="block font-display text-3xl font-black text-ok">{lessons.filter((l) => l.status === "ACCEPTED" && (!l.finalSlot || l.finalSlot.date >= today)).reduce((n, l) => n + (l.price ?? 0), 0)} €</b><small className="text-muted">à encaisser</small></div>
        <div><b className="block font-display text-3xl font-black">{collapseSeries(lessons.filter((l) => l.status === "BOOKED")).length}</b><small className="text-muted">à confirmer</small></div>
      </div>
      <PriceNote />
      {lessons.length === 0 && <Empty>Aucun cours réservé pour l'instant 🎾</Empty>}
      {group("🔔 À confirmer", "Un adulte a réservé ces créneaux. Confirme-les, ou dis que tu ne peux pas : le créneau est alors libéré et l'adulte est prévenu. Sans réponse sous 48 h, ils sont libérés tout seuls.", collapseSeries(lessons.filter((l) => l.status === "BOOKED")).sort(byDate))}
      {group("Cours confirmés à venir", null, booked)}
      {group("Demandes sans créneau", "Un adulte t'écrit parce qu'il n'y avait plus de créneau libre : propose-lui une date (il confirmera).", lessons.filter((l) => l.status === "PENDING"))}
      {group("En attente de la confirmation de l'adulte", null, collapseSeries(lessons.filter((l) => l.status === "PROPOSED")))}
      {group("Annulés ou refusés", null, collapseSeries(lessons.filter((l) => l.status === "REFUSED")))}
    </section>
  );
}

function Availability({ p, onSaved }: { p: ProfMe; onSaved: (p: ProfMe) => void }) {
  const [slots, setSlots] = useState<ProfSlot[]>(p.slots);
  const [mode, setMode] = useState<"week" | "date">("week");
  const [weekday, setWeekday] = useState(0), [date, setDate] = useState(""), [start, setStart] = useState("18:00"), [end, setEnd] = useState("20:00");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  function add() {
    setMsg(null);
    if (end <= start) { setMsg({ ok: false, text: "L'heure de fin doit être après l'heure de début." }); return; }
    if (mode === "date" && !date) { setMsg({ ok: false, text: "Choisis la date." }); return; }
    setSlots([...slots, mode === "week" ? { weekday, date: null, start, end } : { weekday: null, date, start, end }]);
  }
  async function save() {
    setMsg(null);
    try { const saved = await put<ProfMe>("/profs/me/slots", { slots: slots.map((s) => (s.weekday !== null ? { weekday: s.weekday, start: s.start, end: s.end } : { date: s.date, start: s.start, end: s.end })) }); onSaved(saved); setMsg({ ok: true, text: saved.outsideCount ? `Disponibilités actualisées ✓ — attention : ${saved.outsideCount} cours déjà réservé${saved.outsideCount > 1 ? "s" : ""} ne tombe${saved.outsideCount > 1 ? "nt" : ""} plus dans tes disponibilités. Rien n'est annulé : préviens le coach ou l'adulte si tu ne peux pas.` : "Disponibilités actualisées ✓" }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  async function setHolidays(v: boolean) {
    setMsg(null);
    try { onSaved(await put<ProfMe>("/profs/me", { skipHolidays: v })); setMsg({ ok: true, text: v ? "Pas de cours en vacances ni les jours fériés ✓" : "Tes créneaux sont aussi proposés pendant les vacances ✓" }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  async function pause(v: boolean) {
    setMsg(null);
    try { onSaved(await put<ProfMe>("/profs/me", { paused: v })); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  return (
    <section className="grid gap-4" aria-labelledby="pd-h">
      <div className="grid gap-1"><h2 id="pd-h" className="m-0">🕒 Mes disponibilités</h2><p className="m-0 text-muted">Les adultes voient ces créneaux sur ta carte. Ajoute des créneaux qui reviennent chaque semaine, ou une date précise. Tu peux les <strong>actualiser à tout moment</strong>.</p>{p.updatedAt && <p className="m-0 text-sm font-bold text-ink">Dernière mise à jour : {new Date(p.updatedAt).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).replace(":", " h ")}</p>}</div>
      <div className="card grid gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type de créneau">
          {([["week", "🔁 Chaque semaine"], ["date", "📆 Une date précise"]] as const).map(([k, l]) => <button key={k} aria-pressed={mode === k} className={"rounded-full border-2 px-4 py-2 font-bold " + (mode === k ? "border-clay bg-[#fdf1ea] text-clay" : "border-line bg-white")} onClick={() => setMode(k)}>{l}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {mode === "week"
            ? <Field label="Jour" id="av-day"><select id="av-day" className="input" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
            : <Field label="Date" id="av-date"><input id="av-date" type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
          <Field label="De" id="av-from"><select id="av-from" className="input" value={start} onChange={(e) => setStart(e.target.value)}>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
          <Field label="À" id="av-to"><select id="av-to" className="input" value={end} onChange={(e) => setEnd(e.target.value)}>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
        </div>
        <div><button className="btn-outline btn-sm" onClick={add}>+ Ajouter ce créneau</button></div>
      </div>
      {slots.length === 0 ? <Empty>Aucun créneau : les adultes verront « Aucune disponibilité indiquée ».</Empty> : (
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">{slots.map((s, i) => <li key={i} className="flex items-center justify-between gap-2 rounded-xl border-2 border-ok bg-[#f1faf5] px-3 py-2 font-bold text-[#1d6b43]">{fmtProfSlot(s)}<button className="btn-outline btn-sm" aria-label={`Retirer le créneau ${fmtProfSlot(s)}`} onClick={() => setSlots(slots.filter((_, j) => j !== i))}>✕</button></li>)}</ul>
      )}
      <div className="flex flex-wrap items-center gap-3"><button className="btn-clay" onClick={save}>🔄 Actualiser mes disponibilités</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
      <div className="card grid gap-1 text-sm"><strong>Ce qui se passe quand tu actualises</strong><ul className="m-0 grid gap-1 pl-5"><li>Les <strong>nouveaux créneaux</strong> sont proposés aux adultes tout de suite.</li><li>Les <strong>cours déjà réservés ne bougent pas</strong>.</li><li>Si un cours déjà réservé ne tombe plus dans tes disponibilités, on te le signale : rien n'est annulé tout seul.</li></ul></div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line bg-white p-4 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-clay" checked={p.skipHolidays !== false} onChange={(e) => setHolidays(e.target.checked)} />
        <span className="grid"><strong>🏖️ Je ne donne pas de cours pendant les vacances scolaires et les jours fériés</strong><span className="text-sm text-muted">Vacances de la zone C (Paris) et jours fériés : tes créneaux « chaque semaine » ne sont pas proposés ces jours-là. Décoche si tu donnes cours en vacances (stages…). Une date précise que tu ajoutes est toujours proposée.</span></span>
      </label>
      <div className="card grid gap-2 border-dashed">
        <strong>⏸ Pause</strong>
        <p className="m-0 text-sm text-muted">Si tu ne veux plus recevoir de demandes pour le moment, mets-toi en pause : les adultes te voient toujours, mais ne peuvent plus te demander de cours.</p>
        <div><button className={p.paused ? "btn-clay btn-sm" : "btn-outline btn-sm"} onClick={() => pause(!p.paused)}>{p.paused ? "▶ Reprendre les demandes" : "⏸ Je ne prends plus de demandes pour le moment"}</button></div>
      </div>
    </section>
  );
}

function Presentation({ p, onSaved }: { p: ProfMe; onSaved: (p: ProfMe) => void }) {
  const { me, reload } = useAuth();
  const [form, setForm] = useState({ lastName: p.lastName ?? "", birthYear: p.birthYear ? String(p.birthYear) : "", showAge: p.showAge, ranking: p.ranking ?? "", bestRanking: p.bestRanking ?? "", bio: p.bio });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    try { onSaved(await put<ProfMe>("/profs/me", { lastName: form.lastName, birthYear: Number(form.birthYear) || undefined, showAge: form.showAge, ranking: form.ranking, bestRanking: form.bestRanking, bio: form.bio })); await reload(); setMsg({ ok: true, text: "Enregistré ✓" }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  const age = form.showAge && Number(form.birthYear) ? new Date().getFullYear() - Number(form.birthYear) : null;
  const preview: ProfCard = { id: "me", firstName: me?.firstName ?? p.firstName, lastName: form.lastName || null, age, ranking: form.ranking || null, bestRanking: form.bestRanking || null, bio: form.bio, paused: p.paused, slots: p.slots };
  return (
    <section className="grid gap-4" aria-labelledby="pp-h">
      <div className="grid gap-1"><h2 id="pp-h" className="m-0">🙋 Ma présentation</h2><p className="m-0 text-muted">Ce que les adultes lisent sur ta carte. Ton âge n'est montré que si tu le décides.</p></div>
      <form onSubmit={save} className="card grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" id="pp-first" hint="Donné par le coach à la création de ton compte."><input id="pp-first" className="input" value={me?.firstName ?? ""} disabled /></Field>
          <Field label="Nom" id="pp-last"><input id="pp-last" className="input" maxLength={60} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Année de naissance" id="pp-year"><input id="pp-year" type="number" inputMode="numeric" min={1930} max={2012} className="input" value={form.birthYear} onChange={(e) => set("birthYear", e.target.value)} /></Field>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-xl border-2 border-line bg-white px-3 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]"><input type="checkbox" className="h-5 w-5 accent-clay" checked={form.showAge} onChange={(e) => set("showAge", e.target.checked)} />Montrer mon âge aux adultes</label>
          <Field label="Classement actuel" id="pp-rank"><select id="pp-rank" className="input" value={form.ranking} onChange={(e) => set("ranking", e.target.value)}><option value="">—</option>{PROF_LEVELS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Meilleur classement" id="pp-best"><select id="pp-best" className="input" value={form.bestRanking} onChange={(e) => set("bestRanking", e.target.value)}><option value="">—</option>{PROF_LEVELS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        </div>
        <Field label={`Un mot sur moi (${form.bio.length}/200)`} id="pp-bio"><textarea id="pp-bio" className="input" maxLength={200} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Ex. : à l'aise avec les débutants, service et coup droit" /></Field>
        <div className="flex flex-wrap items-center gap-3"><button className="btn-clay">Enregistrer</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
      </form>
      <h3 className="m-0 text-lg">👀 Voici comment les adultes te voient</h3>
      <ProfCardView p={preview} />
    </section>
  );
}

function Documents({ p, id, onChanged }: { p: ProfMe; id: string; onChanged: (p: ProfMe) => void }) {
  const [err, setErr] = useState("");
  const [valid, setValid] = useState(""); // fin de validité de la carte professionnelle
  async function upload(kind: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setErr("");
    if (file.size > 3 * 1024 * 1024) { setErr("Document trop lourd (3 Mo maximum)."); return; }
    if (kind === "CARTE_PRO" && !valid) { setErr("Indique d'abord la date de fin de validité de ta carte professionnelle."); return; }
    try { onChanged(await api<ProfMe>(`/profs/me/documents/${kind}?fileName=${encodeURIComponent(file.name)}${kind === "CARTE_PRO" ? `&validUntil=${valid}` : ""}`, { method: "PUT", body: file, headers: { "Content-Type": "application/octet-stream" } })); } catch (x) { setErr((x as Error).message); }
  }
  async function remove(kind: string) {
    if (!confirm("Supprimer ce document ? Tu ne seras plus visible des adultes tant qu'il manque une pièce.")) return;
    try { onChanged(await del<ProfMe>(`/profs/me/documents/${kind}`)); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <section className="grid gap-4" aria-labelledby="pdoc-h">
      <div className="grid gap-1"><h2 id="pdoc-h" className="m-0">📎 Mes documents</h2><p className="m-0 text-muted">Pour être visible des adultes, dépose ces 3 pièces. <strong>Seul le coach les voit</strong>, jamais les adultes ni les autres professeurs. PDF ou photo (JPEG, PNG), 3 Mo maximum. Quand tu remplaces une pièce, le coach doit la revalider.</p></div>
      <Err msg={err} />
      <ul className="m-0 grid list-none gap-3 p-0">
        {DOC_KINDS.map((k) => { const d = p.documents.find((x) => x.kind === k.kind); const expired = d?.validUntil ? new Date(d.validUntil) < new Date() : false; return (
          <li key={k.kind} className={"card grid gap-3 " + (d && !expired ? "" : "!border-2 !border-dashed !border-bad")}>
            <div className="grid gap-0.5"><strong className="text-lg">{k.icon} {k.label} {d && !expired ? <span className="text-ok">✓</span> : null}</strong><small className="hint">{k.help}</small></div>
            {d && <p className="m-0 text-sm">Déposé le {fmtDate(d.uploadedAt)} · {d.fileName}{d.validUntil && <> · <span className={expired ? "font-bold text-bad" : ""}>valable jusqu'au {fmtDate(d.validUntil)}{expired ? " (expirée)" : ""}</span></>}</p>}
            {k.kind === "CARTE_PRO" && <Field label="Date de fin de validité de la carte" id="doc-valid"><input id="doc-valid" type="date" className="input max-w-xs" min={new Date().toISOString().slice(0, 10)} value={valid} onChange={(e) => setValid(e.target.value)} /></Field>}
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-clay btn-sm cursor-pointer">{d ? "Remplacer" : "Déposer"}<input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => upload(k.kind, e)} /></label>
              {d && <a className="btn-outline btn-sm no-underline" href={`/api/profs/${id}/documents/${k.kind}`} target="_blank" rel="noopener noreferrer">Ouvrir ↗</a>}
              {d && <button className="btn-danger btn-sm" onClick={() => remove(k.kind)}>Supprimer</button>}
            </div>
          </li>
        ); })}
      </ul>
      <p className="hint m-0">🔒 Ces pièces sont gardées dans la base du club, tant que ton compte existe, et supprimées avec lui. <a href="/confidentialite" className="font-bold text-clay underline">Politique de confidentialité</a></p>
    </section>
  );
}
