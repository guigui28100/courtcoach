import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { api, del, get, put } from "../api";
import { useAuth } from "../auth";
import { PROF_LEVELS, PriceNote, ProfCardView } from "../components/Profs";
import { Empty, Err, Field, Page, PageHead, SideLayout, TabsBar } from "../components/ui";
import { DOC_KINDS, fmtDate, fmtProfSlot, Lesson, ProfCard, ProfMe, ProfSlot, STATUS_TEXT, WEEKDAYS } from "../types";
import { LessonRow } from "./Coach";

type Tab = "demandes" | "dispos" | "presentation" | "documents";
const TABS: Tab[] = ["demandes", "dispos", "presentation", "documents"];
const HOURS = Array.from({ length: 29 }, (_, i) => { const m = 7 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`; }); // 07:00 → 21:00
const hourLabel = (t: string) => t.replace(":00", " h").replace(":30", " h 30");

// Espace du professeur de cours particuliers : demandes reçues, disponibilités, présentation, documents
export function ProfSpace() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((k) => k === params.get("onglet")) ?? "demandes";
  const [p, setP] = useState<ProfMe | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [err, setErr] = useState("");
  const loadMe = useCallback(() => { get<ProfMe>("/profs/me").then(setP).catch((e) => setErr((e as Error).message)); }, []);
  const loadLessons = useCallback(() => { get<Lesson[]>("/lessons").then(setLessons).catch(() => setLessons([])); }, []);
  useEffect(() => { loadMe(); loadLessons(); }, [loadMe, loadLessons]);
  if (me && me.trainerKind !== "PROF") return <Navigate to="/coach/centre" replace />;
  const todo = (lessons ?? []).filter((l) => l.status === "PENDING").length;
  const missing = p ? p.status === "missing" || p.status === "expired" : false;
  const go = (k: string) => { setParams(k === "demandes" ? {} : { onglet: k }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const st = p ? STATUS_TEXT[p.status] : null;
  return (
    <>
      <PageHead eyebrow="Mon espace professeur" title={me?.firstName ? `Bonjour ${me.firstName} !` : "Bonjour !"}>Tes demandes de cours, tes disponibilités et ta présentation, au même endroit.</PageHead>
      <Page>
        {st && <p role="status" className={"m-0 rounded-2xl border-2 p-3 font-bold " + (st[1] === "ok" ? "border-ok bg-[#eef8f1] text-ok" : st[1] === "bad" ? "border-bad bg-[#fdf0ee] text-bad" : "border-[#c08a00] bg-[#fff8e1] text-[#7a5a00]")}>{st[0]}</p>}
        <Err msg={err} />
        <SideLayout nav={<TabsBar label="Mon espace professeur" active={tab} onChange={go} tabs={[["demandes", "📨 Mes demandes", todo], ["dispos", "📅 Mes disponibilités"], ["presentation", "🙋 Ma présentation"], ["documents", "📎 Mes documents", missing ? 1 : 0]]} />}>
          {tab === "demandes" && <Requests lessons={lessons} reload={loadLessons} />}
          {tab === "dispos" && p && <Availability p={p} onSaved={setP} />}
          {tab === "presentation" && p && <Presentation p={p} onSaved={setP} />}
          {tab === "documents" && p && <Documents p={p} id={me?.id ?? ""} onChanged={setP} />}
          {!p && !err && <div className="skeleton h-40" role="status" aria-label="Chargement en cours" />}
        </SideLayout>
      </Page>
    </>
  );
}

function Requests({ lessons, reload }: { lessons: Lesson[] | null; reload: () => void }) {
  if (!lessons) return <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const group = (title: string, list: Lesson[]) => list.length > 0 && <section className="grid gap-2"><h3 className="m-0 text-lg">{title} ({list.length})</h3><ul className="m-0 grid list-none gap-3 p-0">{list.map((l) => <LessonRow key={l.id} l={l} onDone={reload} asProf />)}</ul></section>;
  return (
    <section className="grid gap-5" aria-labelledby="pr-h">
      <div className="grid gap-1"><h2 id="pr-h" className="m-0">📨 Mes demandes de cours</h2><p className="m-0 text-muted">Les adultes qui t'ont choisi. Propose une date : le cours n'est valable que quand l'adulte la confirme. Le coach voit aussi ces demandes.</p></div>
      <PriceNote />
      {lessons.length === 0 && <Empty>Aucune demande pour l'instant 🎾</Empty>}
      {group("À traiter", lessons.filter((l) => l.status === "PENDING"))}
      {group("En attente de la confirmation de l'adulte", lessons.filter((l) => l.status === "PROPOSED"))}
      {group("Cours confirmés", lessons.filter((l) => l.status === "ACCEPTED"))}
      {group("Refusés ou annulés", lessons.filter((l) => l.status === "REFUSED"))}
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
    try { onSaved(await put<ProfMe>("/profs/me/slots", { slots: slots.map((s) => (s.weekday !== null ? { weekday: s.weekday, start: s.start, end: s.end } : { date: s.date, start: s.start, end: s.end })) })); setMsg({ ok: true, text: "Disponibilités enregistrées ✓" }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  async function pause(v: boolean) {
    setMsg(null);
    try { onSaved(await put<ProfMe>("/profs/me", { paused: v })); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  return (
    <section className="grid gap-4" aria-labelledby="pd-h">
      <div className="grid gap-1"><h2 id="pd-h" className="m-0">📅 Mes disponibilités</h2><p className="m-0 text-muted">Les adultes voient ces créneaux sur ta carte. Ajoute des créneaux qui reviennent chaque semaine, ou une date précise.</p></div>
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
      <div className="flex flex-wrap items-center gap-3"><button className="btn-clay" onClick={save}>Enregistrer mes disponibilités</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
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
