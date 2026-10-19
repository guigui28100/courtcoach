import { useCallback, useEffect, useState } from "react";
import { get, post, put } from "../api";
import { useAuth } from "../auth";
import { ADULT_LEVELS, DOC_KINDS, fmtDate, fmtProfSlot, PlanDay, PRICE_MEMBER, PRICE_OTHER, ProfAdmin, ProfCard, ProfStatus, profName, WEEKDAYS } from "../types";
import { Avatar, Empty, Err } from "./ui";

export const PROF_LEVELS = ADULT_LEVELS.filter((x) => !["Débutant", "Loisir / intermédiaire", "NC"].includes(x));

// Exemples INVENTÉS montrés dans « Voir comme un adulte » (aucun vrai professeur)
const sampleDate = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
export const EXAMPLE_PROFS: ProfCard[] = [
  { id: "ex-1", firstName: "Claire", lastName: "Exemple", age: 34, ranking: "15/1", bestRanking: "4/6", bio: "Je suis à l'aise avec les débutants et la remise en route. Service et coup droit sont mes spécialités.", paused: false, slots: [{ weekday: 1, date: null, start: "18:00", end: "20:00" }, { weekday: 3, date: null, start: "12:00", end: "14:00" }, { weekday: 5, date: null, start: "09:00", end: "12:00" }] },
  { id: "ex-2", firstName: "Marc", lastName: "Exemple", age: null, ranking: "30", bestRanking: "15/2", bio: "Tennis loisir, jeu en double, tactique et placement.", paused: false, slots: [{ weekday: 0, date: null, start: "17:00", end: "19:00" }, { weekday: null, date: sampleDate, start: "14:00", end: "17:00" }] },
  { id: "ex-3", firstName: "Sophie", lastName: "Exemple", age: 41, ranking: "15/4", bestRanking: "15/1", bio: "", paused: true, slots: [] },
];

// Pastille d'information (âge, classement…)
const Fact = ({ k, v }: { k: string; v: string }) => <div className="rounded-xl bg-sand px-3 py-1.5 text-sm"><b className="block text-[0.7rem] font-bold uppercase tracking-wider text-clay">{k}</b>{v}</div>;

// Bandeau « terre battue » avec la balle et les étapes de la réservation
export function ClayHero({ title, text, step }: { title: string; text: string; step: 1 | 2 | 3 }) {
  return (
    <header className="relative overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-clay to-clay-dark p-5 text-white sm:p-6">
      <span aria-hidden="true" className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-ball opacity-90" />
      <span aria-hidden="true" className="absolute right-4 top-2 h-28 w-28 rounded-full border-[3px] border-white/70 border-x-transparent" />
      <h3 className="relative m-0 text-2xl font-black text-white sm:text-3xl">{title}</h3>
      <p className="relative m-0 mt-1 max-w-[80%] text-white/95">{text}</p>
      <ol className="relative m-0 mt-3 flex list-none flex-wrap gap-2 p-0" aria-label="Étapes de la réservation">
        {["Professeur", "Objectif", "Créneau"].map((x, i) => <li key={x} aria-current={step === i + 1 ? "step" : undefined} className={"rounded-full px-3 py-1 text-sm font-bold " + (step === i + 1 ? "bg-ball text-ink" : "bg-white/20 text-white")}>{["①", "②", "③"][i]} {x}</li>)}
      </ol>
    </header>
  );
}

const dayOfIso = (iso: string) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
const SHORT_L = ["L", "M", "M", "J", "V", "S", "D"];

// Carte d'un professeur : présentation rapide, jours de disponibilité, tarif, bouton pour choisir
export function ProfCardView({ p, onPick, preview, price, selected }: { p: ProfCard; onPick?: (p: ProfCard) => void; preview?: boolean; price?: number; selected?: boolean }) {
  const name = profName(p);
  const days = new Set(p.slots.map((s) => s.weekday ?? (s.date ? dayOfIso(s.date) : -1)));
  return (
    <article className={"relative grid content-start gap-3 rounded-[1.2rem] border-2 bg-white p-4 " + (selected ? "border-clay shadow-[0_6px_0_var(--color-clay)]" : "border-line")} aria-label={`Professeur : ${name}`}>
      {price ? <div className="absolute right-4 top-3 text-right leading-tight"><b className="font-display text-2xl font-black text-clay">{price} €</b><small className="block text-xs text-muted">{price === PRICE_MEMBER ? `${PRICE_OTHER} € non adhérent` : `${PRICE_MEMBER} € adhérent`}</small></div> : null}
      <div className="flex items-center gap-3 pr-24">
        <span className="rounded-full ring-[3px] ring-ball"><Avatar name={name} size={60} /></span>
        <div><h3 className="m-0 text-xl">{name}</h3><small className="text-muted">{[p.age !== null ? `${p.age} ans` : null, p.ranking ? `classement ${p.ranking}` : null, p.bestRanking ? `meilleur ${p.bestRanking}` : null].filter(Boolean).join(" · ") || "Professeur de tennis"}</small></div>
      </div>
      <div className="flex flex-wrap gap-2">{p.paused ? <span className="rounded-full bg-[#fff3cd] px-3 py-0.5 text-xs font-bold text-[#7a5a00]">⏸ En pause</span> : p.slots.length ? <span className="rounded-full bg-[#dff3e8] px-3 py-0.5 text-xs font-bold text-[#1c6b42]">● Disponible</span> : <span className="rounded-full bg-sand px-3 py-0.5 text-xs font-bold">Pas de disponibilité</span>}</div>
      {p.bio && <p className="m-0 text-sm">« {p.bio} »</p>}
      <div className="flex gap-1.5" role="img" aria-label={"Jours où il est disponible : " + ([...days].filter((d) => d >= 0).sort().map((d) => WEEKDAYS[d]).join(", ") || "aucun")}>
        {SHORT_L.map((l, i) => <span key={i} aria-hidden="true" className={"flex-1 rounded-lg py-1 text-center text-xs font-bold " + (days.has(i) ? "bg-ink text-white" : "bg-[#eee] text-[#8b8b8b]")}>{l}</span>)}
      </div>
      {p.paused && <p className="m-0 rounded-xl bg-[#fff3cd] p-2.5 text-sm font-bold text-[#7a5a00]">⏸ {p.firstName ?? "Ce professeur"} ne prend plus de demandes pour le moment.</p>}
      {onPick && <div><button className={selected ? "btn-clay" : "btn-outline"} disabled={p.paused} onClick={() => onPick(p)}>{selected ? "✔ Choisi" : `Choisir ${p.firstName ?? "ce professeur"}`}</button>{preview && <small className="hint ml-2">(aperçu)</small>}</div>}
    </article>
  );
}

// Rappel des tarifs (fixés par le club) : jamais de paiement sur le site
export function PriceNote({ yourPrice }: { yourPrice?: number | null }) {
  return (
    <p className="m-0 rounded-2xl bg-sand p-3 text-sm">💶 <strong>Tarif d'une séance :</strong> {PRICE_MEMBER} € pour un adhérent du TC Houdan, {PRICE_OTHER} € pour les autres.{yourPrice ? <> Ton tarif : <strong>{yourPrice} €</strong>.</> : null} Le règlement se fait directement avec le professeur : rien ne se paie sur le site.</p>
  );
}

// Choix du professeur (adulte) : liste, filtre par jour, tarif
export function ProfChooser({ preview, onPick, onNoPref, onClose }: { preview: boolean; onPick: (p: ProfCard, price: number) => void; onNoPref: () => void; onClose: () => void }) {
  const { me, reload } = useAuth();
  const [profs, setProfs] = useState<ProfCard[] | null>(preview ? EXAMPLE_PROFS : null);
  const [yourPrice, setYourPrice] = useState<number>(PRICE_OTHER);
  const [pvMember, setPvMember] = useState(false); // aperçu : on peut cocher / décocher pour voir le tarif changer (rien n'est enregistré)
  const [day, setDay] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { if (preview) return; get<{ profs: ProfCard[]; yourPrice: number | null }>("/profs").then((r) => { setProfs(r.profs); if (r.yourPrice) setYourPrice(r.yourPrice); }).catch((e) => { setProfs([]); setErr((e as Error).message); }); }, [preview]);
  useEffect(load, [load]);
  const member = preview ? pvMember : !!me?.clubMember;
  async function toggleMember(v: boolean) {
    if (preview) { setPvMember(v); return; }
    if (!me) return;
    setErr("");
    try { await put("/auth/me/profile", { firstName: me.firstName ?? "", lastName: me.lastName ?? "", birthYear: me.birthYear ?? undefined, level: me.level ?? "", phone: me.phone ?? "", clubMember: v }); await reload(); load(); } catch (x) { setErr((x as Error).message); }
  }
  const dayOf = (iso: string) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
  const shown = (profs ?? []).filter((p) => day === null || p.slots.some((s) => (s.weekday ?? (s.date ? dayOf(s.date) : -1)) === day));
  return (
    <section className="grid gap-4 rounded-3xl border-2 border-clay bg-chalk p-3 shadow-sm sm:p-4" aria-label="Choisir mon professeur">
      <ClayHero title="Réserver un cours particulier" text="Choisis ton professeur, puis le créneau qui t'arrange. C'est confirmé tout de suite." step={1} />
      <div className="flex justify-end"><button className="btn-outline btn-sm" onClick={onClose}>Annuler</button></div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-white px-3 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
        <input type="checkbox" className="h-5 w-5 accent-clay" checked={member} onChange={(e) => toggleMember(e.target.checked)} />Je suis adhérent du TC Houdan
      </label>
      <PriceNote yourPrice={preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice} />
      <Err msg={err} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par jour">
        {[null, ...WEEKDAYS.map((_, i) => i)].map((d) => <button key={d ?? "all"} className={"rounded-full border-2 px-4 py-1.5 text-sm font-bold " + (day === d ? "border-ink bg-ink text-white" : "border-ink bg-white text-ink")} aria-pressed={day === d} onClick={() => setDay(d)}>{d === null ? "Tous" : WEEKDAYS[d]}</button>)}
      </div>
      {profs === null ? <div className="skeleton h-32" role="status" aria-label="Chargement en cours" /> : shown.length === 0 ? <Empty>{profs.length === 0 ? "Aucun professeur n'est visible pour le moment." : "Aucun professeur n'est disponible ce jour-là."}</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">{shown.map((p) => <ProfCardView key={p.id} p={p} preview={preview} price={preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice} onPick={(x) => onPick(x, preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice)} />)}</div>
      )}
      <p className="m-0 text-sm text-muted">Tu préfères que le coach choisisse pour toi ? <button className="font-bold text-clay underline" onClick={onNoPref}>Demander au coach directement</button></p>
    </section>
  );
}

const STATUS_BADGE: Record<ProfStatus, [string, string]> = {
  visible: ["✅ Visible des adultes", "!border-ok !text-ok"],
  paused: ["⏸ En pause", "!border-[#c08a00] !text-[#7a5a00]"],
  waiting: ["⏳ À valider", "!border-[#c08a00] !text-[#7a5a00]"],
  missing: ["📎 Documents manquants", "!border-bad !text-bad"],
  expired: ["⚠ Carte expirée", "!border-bad !text-bad"],
};

// Coach : tous les professeurs, leurs documents, validation
export function ProfsAdmin({ onChanged }: { onChanged?: () => void }) {
  const [list, setList] = useState<ProfAdmin[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { get<ProfAdmin[]>("/profs/admin").then(setList).catch((e) => { setList([]); setErr((e as Error).message); }); }, []);
  useEffect(load, [load]);
  async function approve(p: ProfAdmin, approved: boolean) {
    setErr("");
    try { await post(`/profs/${p.id}/approval`, { approved }); load(); onChanged?.(); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <section className="grid gap-4" aria-labelledby="pa-h">
      <div className="grid gap-1">
        <h2 id="pa-h" className="m-0 text-xl">👩‍🏫 Professeurs de cours particuliers</h2>
        <p className="hint m-0">Tu crées les comptes dans <strong>Jeunes · Centre → 👥 Entraîneurs</strong> ; c'est l'entraîneur qui clique « Je souhaite donner des cours particuliers » dans son espace. Un professeur n'est visible des adultes que si les <strong>3 documents</strong> sont déposés, que la <strong>carte professionnelle est valable</strong> et que <strong>tu l'as validé</strong> ici. Si un document est remplacé, tu dois revalider. Le site ne peut pas vérifier la carte auprès de l'administration : c'est à toi de contrôler les pièces.</p>
      </div>
      <Err msg={err} />
      {list === null ? <div className="skeleton h-24" role="status" aria-label="Chargement en cours" /> : list.length === 0 ? <Empty>Aucun professeur pour l'instant.</Empty> : (
        <ul className="m-0 grid list-none gap-4 p-0">
          {list.map((p) => { const b = STATUS_BADGE[p.status]; const name = profName(p); return (
            <li key={p.id} className="card grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3"><Avatar name={name} size={44} /><span><strong className="block text-lg">{name}</strong><small className="hint">{p.email} · {p.requests} demande{p.requests > 1 ? "s" : ""} · {p.slotCount} disponibilité{p.slotCount > 1 ? "s" : ""}</small></span></span>
                <span className={"badge " + b[1]}>{b[0]}</span>
              </div>
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
                {DOC_KINDS.map((k) => { const d = p.documents.find((x) => x.kind === k.kind); return (
                  <li key={k.kind} className={"rounded-xl border-2 p-3 text-sm " + (d ? "border-line bg-white" : "border-dashed border-bad bg-[#fdf0ee]")}>
                    <strong>{k.icon} {k.label}</strong>
                    {d ? <><br /><span className="text-muted">déposé le {fmtDate(d.uploadedAt)}</span>{d.validUntil && <><br /><span className={new Date(d.validUntil) < new Date() ? "font-bold text-bad" : "text-muted"}>valable jusqu'au {fmtDate(d.validUntil)}</span></>}<br /><a className="font-bold text-clay underline" href={`/api/profs/${p.id}/documents/${k.kind}`} target="_blank" rel="noopener noreferrer">Ouvrir le document ↗</a></> : <><br /><span className="font-bold text-bad">Manquant</span></>}
                  </li>
                ); })}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                {p.status === "waiting" && <button className="btn-clay btn-sm" onClick={() => approve(p, true)}>✅ J'ai vérifié : rendre visible</button>}
                {(p.status === "visible" || p.status === "paused") && <button className="btn-outline btn-sm" onClick={() => approve(p, false)}>Retirer de la liste</button>}
                {p.status === "missing" && <span className="hint">En attente des documents.</span>}
                {p.status === "expired" && <span className="hint">Carte expirée : le professeur doit déposer la nouvelle.</span>}
              </div>
            </li>
          ); })}
        </ul>
      )}
    </section>
  );
}


// ───────── Planning : les créneaux d'une heure d'un professeur, à toucher pour réserver ─────────
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAY_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const hour = (t: string) => (t.slice(3, 5) === "00" ? `${Number(t.slice(0, 2))} h` : `${Number(t.slice(0, 2))} h ${t.slice(3, 5)}`);
export const fmtPlanSlot = (date: string, time: string, end: string) => `${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · ${hour(time)} – ${hour(end)}`;

// Aperçu du coach : planning calculé ici à partir des disponibilités d'exemple (quelques créneaux sont « déjà pris »)
export function previewPlanning(slots: ProfCard["slots"]): PlanDay[] {
  const days: PlanDay[] = []; const base = new Date(); base.setHours(12, 0, 0, 0);
  for (let i = 1; i <= 28; i++) {
    const d = new Date(base.getTime() + i * 86_400_000); const iso = d.toISOString().slice(0, 10); const wd = (d.getDay() + 6) % 7;
    const starts = new Set<number>();
    for (const s of slots) if (s.weekday === wd || s.date === iso) for (let m = Number(s.start.slice(0, 2)); m + 1 <= Number(s.end.slice(0, 2)); m++) starts.add(m);
    const list = [...starts].sort((a, b) => a - b).map((h, k) => ({ time: `${String(h).padStart(2, "0")}:00`, end: `${String(h + 1).padStart(2, "0")}:00`, free: !((i + k) % 3 === 0) }));
    if (list.length) days.push({ date: iso, slots: list });
  }
  return days;
}

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const shiftDay = (iso: string, n: number) => isoOf(new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86_400_000));
const mondayOf = (iso: string) => shiftDay(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7));
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Planning en TABLEAU : les jours en colonnes (une semaine à la fois), les heures en lignes ; on touche une case verte pour choisir son créneau
export function PlanningPicker({ days, value, onChange }: { days: PlanDay[]; value: { date: string; time: string } | null; onChange: (v: { date: string; time: string } | null) => void }) {
  const mondays = [...new Set(days.map((d) => mondayOf(d.date)))].sort();
  const firstFree = days.find((d) => d.slots.some((s) => s.free))?.date;
  const startAt = value?.date ?? firstFree ?? days[0]?.date;
  const [wi, setWi] = useState(Math.max(0, startAt ? mondays.indexOf(mondayOf(startAt)) : 0));
  if (!mondays.length) return null;
  const monday = mondays[Math.min(wi, mondays.length - 1)];
  const dates = Array.from({ length: 7 }, (_, k) => shiftDay(monday, k));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const times = [...new Set(dates.flatMap((d) => (byDate.get(d)?.slots ?? []).map((s) => s.time)))].sort(); // seulement les heures où quelqu'un est disponible cette semaine
  const today = new Date().toLocaleDateString("sv-SE");
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const chosen = value ? byDate.get(value.date)?.slots.find((s) => s.time === value.time) : null;
  return (
    <div className="grid gap-3 rounded-3xl bg-gradient-to-b from-[#fdf6ee] to-[#f6ebdd] p-3 ring-1 ring-line sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Semaine précédente" disabled={wi <= 0} onClick={() => setWi(wi - 1)} className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white text-lg font-bold disabled:opacity-30">‹</button>
        <strong className="text-center font-display text-base sm:text-lg">Semaine du {label(dates[0])} au {label(dates[6])}</strong>
        <button type="button" aria-label="Semaine suivante" disabled={wi >= mondays.length - 1} onClick={() => setWi(wi + 1)} className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white text-lg font-bold disabled:opacity-30">›</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-[3px] sm:border-spacing-1">
          <caption className="sr-only">Planning de la semaine : jours en colonnes, heures en lignes</caption>
          <thead>
            <tr>
              <td className="w-8 sm:w-12" />
              {dates.map((d, k) => { const free = byDate.get(d)?.slots.filter((s) => s.free).length ?? 0; const now = d === today; return (
                <th key={d} scope="col" className={"rounded-xl px-0 py-1 text-center " + (now ? "bg-ink text-white" : "bg-[#f3e7d9]")}>
                  <small className={"block text-[0.65rem] font-bold uppercase tracking-wider sm:text-xs " + (now ? "text-[#dcf247]" : "text-muted")}>{DAY_NAMES[k]}</small>
                  <b className="font-display text-base leading-tight sm:text-xl">{Number(d.slice(8, 10))}</b>
                  <small className={"block text-[0.6rem] font-bold " + (now ? "text-white/80" : free ? "text-[#1d6b43]" : "text-muted/70")}>{free ? `${free} libre${free > 1 ? "s" : ""}` : "—"}</small>
                </th>
              ); })}
            </tr>
          </thead>
          <tbody>
            {times.map((t) => (
              <tr key={t}>
                <th scope="row" className="pr-1 text-right text-[0.7rem] font-bold text-muted sm:text-xs">{hour(t)}</th>
                {dates.map((d) => {
                  const slot = byDate.get(d)?.slots.find((x) => x.time === t);
                  const sel = value?.date === d && value.time === t;
                  const when = `${new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, ${hour(t)}`;
                  if (!slot) return <td key={d} className="h-9 rounded-lg bg-[#f6f1ea] sm:h-10" aria-label={`${when} : pas disponible`} />;
                  if (!slot.free) return <td key={d} aria-label={`${when} : déjà réservé`} className="h-9 rounded-lg bg-[repeating-linear-gradient(135deg,#f3ece3,#f3ece3_5px,#e6dccf_5px,#e6dccf_10px)] text-center text-[0.55rem] text-[#9a8f84] sm:h-10 sm:text-[0.65rem]">réservé</td>;
                  return (
                    <td key={d} className="p-0">
                      <button type="button" aria-pressed={sel} aria-label={`${when} : libre`} onClick={() => onChange(sel ? null : { date: d, time: t })} className={"h-9 w-full rounded-lg border-2 text-base font-bold transition sm:h-10 " + (sel ? "border-[#1d6b43] bg-[#1d6b43] text-white shadow-md" : "border-[#bfe3cd] bg-[#e8f6ee] hover:border-[#1d6b43] hover:bg-white")}>{sel ? "✔" : ""}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded border-2 border-[#bfe3cd] bg-[#e8f6ee] align-[-1px]" />Libre</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded bg-[#1d6b43] align-[-1px]" />Ton choix</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded bg-[#e6dccf] align-[-1px]" />Déjà réservé</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded bg-[#f6f1ea] align-[-1px]" />Pas disponible</span>
      </div>
      <div role="status" className={"flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 " + (chosen && value ? "bg-ink text-white" : "border-2 border-dashed border-line text-muted")}>
        {chosen && value ? <><span className="grid"><small className="text-white/70">Ton créneau</small><b className="font-display text-lg font-black first-letter:uppercase">{fmtPlanSlot(value.date, chosen.time, chosen.end)}</b></span><span className="ml-auto rounded-full bg-ball px-3 py-1 text-sm font-bold text-ink">✔ Prêt à réserver</span></> : <span className="text-sm font-bold">Touche une case verte pour choisir ton créneau.</span>}
      </div>
    </div>
  );
}
