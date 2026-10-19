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

// Carte d'un professeur : présentation rapide, disponibilités, bouton pour demander un cours
export function ProfCardView({ p, onPick, preview }: { p: ProfCard; onPick?: (p: ProfCard) => void; preview?: boolean }) {
  const name = profName(p);
  return (
    <article className="card grid gap-3" aria-label={`Professeur : ${name}`}>
      <div className="flex items-center gap-3">
        <Avatar name={name} size={56} />
        <div><h3 className="m-0 text-xl">{name}</h3><span className="text-sm text-muted">Professeur de tennis</span></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {p.age !== null && <Fact k="Âge" v={`${p.age} ans`} />}
        {p.ranking && <Fact k="Classement" v={p.ranking} />}
        {p.bestRanking && <Fact k="Meilleur classement" v={p.bestRanking} />}
      </div>
      {p.bio && <p className="m-0">« {p.bio} »</p>}
      <div className="grid gap-2">
        <strong>📅 Disponibilités</strong>
        {p.slots.length ? <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 p-0">{p.slots.map((s, i) => <li key={i} className="rounded-xl border-2 border-ok bg-[#f1faf5] px-3 py-1.5 text-sm font-bold text-[#1d6b43]">{fmtProfSlot(s)}</li>)}</ul> : <p className="m-0 text-sm text-muted">Aucune disponibilité indiquée pour le moment.</p>}
      </div>
      {p.paused && <p className="m-0 rounded-xl bg-[#fff3cd] p-2.5 text-sm font-bold text-[#7a5a00]">⏸ {p.firstName ?? "Ce professeur"} ne prend plus de demandes pour le moment.</p>}
      {onPick && <div><button className="btn-clay" disabled={p.paused} onClick={() => onPick(p)}>✉️ Demander un cours à {p.firstName ?? "ce professeur"}</button>{preview && <small className="hint ml-2">(aperçu)</small>}</div>}
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
    <section className="grid gap-4 rounded-3xl border-2 border-clay bg-white p-5 shadow-sm" aria-label="Choisir mon professeur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5"><h3 className="m-0 text-xl">👩‍🏫 Choisir mon professeur</h3><p className="m-0 text-muted">Voici les professeurs du club et leurs disponibilités. Choisis le tien : ta demande lui est envoyée (le coach la voit aussi).</p></div>
        <button className="btn-outline btn-sm" onClick={onClose}>Annuler</button>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-white px-3 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
        <input type="checkbox" className="h-5 w-5 accent-clay" checked={member} onChange={(e) => toggleMember(e.target.checked)} />Je suis adhérent du TC Houdan
      </label>
      <PriceNote yourPrice={preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice} />
      <Err msg={err} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par jour">
        {[null, ...WEEKDAYS.map((_, i) => i)].map((d) => <button key={d ?? "all"} className={"rounded-full border-2 px-4 py-1.5 text-sm font-bold " + (day === d ? "border-ink bg-ink text-white" : "border-ink bg-white text-ink")} aria-pressed={day === d} onClick={() => setDay(d)}>{d === null ? "Tous" : WEEKDAYS[d]}</button>)}
      </div>
      {profs === null ? <div className="skeleton h-32" role="status" aria-label="Chargement en cours" /> : shown.length === 0 ? <Empty>{profs.length === 0 ? "Aucun professeur n'est visible pour le moment." : "Aucun professeur n'est disponible ce jour-là."}</Empty> : (
        <div className="grid gap-4">{shown.map((p) => <ProfCardView key={p.id} p={p} preview={preview} onPick={(x) => onPick(x, preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice)} />)}</div>
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

export function PlanningPicker({ days, value, onChange }: { days: PlanDay[]; value: { date: string; time: string } | null; onChange: (v: { date: string; time: string } | null) => void }) {
  const first = days.find((d) => d.slots.some((s) => s.free))?.date ?? days[0]?.date ?? null;
  const [open, setOpen] = useState<string | null>(value?.date ?? first);
  const day = days.find((d) => d.date === open) ?? null;
  const groups: [string, string, PlanDay["slots"]][] = day ? [["🌅", "Matin", day.slots.filter((s) => Number(s.time.slice(0, 2)) < 12)], ["☀️", "Après-midi", day.slots.filter((s) => { const h = Number(s.time.slice(0, 2)); return h >= 12 && h < 18; })], ["🌙", "Soirée", day.slots.filter((s) => Number(s.time.slice(0, 2)) >= 18)]] : [];
  return (
    <div className="grid gap-4 rounded-3xl bg-gradient-to-b from-[#fdf6ee] to-[#f6ebdd] p-4 ring-1 ring-line">
      <div className="flex gap-2.5 overflow-x-auto pb-2" role="tablist" aria-label="Jours disponibles">
        {days.map((d) => {
          const dt = new Date(`${d.date}T12:00:00`); const free = d.slots.filter((s) => s.free).length; const on = d.date === open;
          return (
            <button type="button" key={d.date} role="tab" aria-selected={on} onClick={() => setOpen(d.date)} className={"grid min-w-[5.2rem] shrink-0 justify-items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 text-center transition " + (on ? "border-ink bg-ink text-white shadow-lg" : free ? "border-white bg-white shadow-sm hover:-translate-y-0.5 hover:border-clay/50" : "border-transparent bg-white/50 opacity-60")}>
              <small className={"text-[0.7rem] font-bold uppercase tracking-widest " + (on ? "text-[#dcf247]" : "text-muted")}>{DAY_SHORT[dt.getDay()]}</small>
              <strong className="font-display text-3xl leading-none">{dt.getDate()}</strong>
              <small className={on ? "text-white/80" : "text-muted"}>{MONTHS[dt.getMonth()]}</small>
              <span className={"mt-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold " + (free === 0 ? "bg-black/10 text-muted" : on ? "bg-[#dcf247] text-ink" : "bg-[#e6f6ec] text-[#1d6b43]")}>{free === 0 ? "complet" : `${free} libre${free > 1 ? "s" : ""}`}</span>
            </button>
          );
        })}
      </div>
      {day && (
        <div className="grid gap-4" role="tabpanel">
          <h4 className="m-0 font-display text-lg first-letter:uppercase">{new Date(`${day.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h4>
          {groups.filter(([, , l]) => l.length > 0).map(([icon, label, list]) => (
            <div key={label} className="grid gap-2">
              <small className="font-bold uppercase tracking-widest text-muted">{icon} {label}</small>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {list.map((s) => {
                  const sel = value?.date === day.date && value.time === s.time;
                  return s.free ? (
                    <button type="button" key={s.time} aria-pressed={sel} onClick={() => onChange(sel ? null : { date: day.date, time: s.time })} className={"grid min-h-16 content-center justify-items-center rounded-2xl border-2 px-2 py-2 transition " + (sel ? "scale-[1.03] border-[#1d6b43] bg-[#1d6b43] text-white shadow-lg" : "border-[#bfe3cd] bg-white text-[#1d6b43] shadow-sm hover:-translate-y-0.5 hover:border-[#1d6b43] hover:shadow-md")}>
                      <strong className="font-display text-xl leading-tight">{hour(s.time)}</strong>
                      <small className={sel ? "text-white/90" : "text-muted"}>{sel ? "✔ Ton choix" : `jusqu'à ${hour(s.end)}`}</small>
                    </button>
                  ) : (
                    <div key={s.time} aria-label={`${hour(s.time)} : déjà réservé`} className="grid min-h-16 content-center justify-items-center rounded-2xl border-2 border-dashed border-line bg-[repeating-linear-gradient(135deg,#f3ece3,#f3ece3_6px,#ece3d8_6px,#ece3d8_12px)] px-2 py-2 text-[#9a8f84]">
                      <strong className="font-display text-xl leading-tight line-through">{hour(s.time)}</strong><small>Déjà réservé</small>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded border-2 border-[#bfe3cd] bg-white align-[-1px]" />Libre</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded bg-[#1d6b43] align-[-1px]" />Ton choix</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded border border-dashed border-line bg-[#ece3d8] align-[-1px]" />Déjà réservé par un autre adulte</span>
      </div>
    </div>
  );
}
