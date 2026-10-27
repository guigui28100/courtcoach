import { useCallback, useEffect, useState } from "react";
import { get, post, put } from "../api";
import { useAuth } from "../auth";
import { ADULT_LEVELS, DOC_KINDS, fmtDate, fmtProfSlot, PlanDay, PRICE_MEMBER, PRICE_OTHER, SUNDAY_EXTRA, ProfAdmin, ProfCard, ProfStatus, profName, priceOn, WEEKDAYS } from "../types";
import { Avatar, Empty, Err } from "./ui";
import { dayLong, useDayAvailability } from "./CourseCalendar";

export const PROF_LEVELS = ADULT_LEVELS.filter((x) => !["Débutant", "Loisir / intermédiaire", "NC"].includes(x));

// Exemples INVENTÉS montrés dans « Voir comme un adulte » (aucun vrai professeur)
const sampleDate = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
export const EXAMPLE_PROFS: ProfCard[] = [
  { id: "ex-1", firstName: "Guillaume", lastName: "Exemple", age: 34, ranking: "15/1", bestRanking: "4/6", bio: "Je suis à l'aise avec les débutants et la remise en route. Service et coup droit sont mes spécialités.", paused: false, slots: [{ weekday: 1, date: null, start: "18:00", end: "20:00" }, { weekday: 3, date: null, start: "12:00", end: "14:00" }, { weekday: 5, date: null, start: "09:00", end: "12:00" }] },
  { id: "ex-2", firstName: "Martin", lastName: "Exemple", age: null, ranking: "30", bestRanking: "15/2", bio: "Tennis loisir, jeu en double, tactique et placement.", paused: false, slots: [{ weekday: 0, date: null, start: "17:00", end: "19:00" }, { weekday: null, date: sampleDate, start: "14:00", end: "17:00" }] },
  { id: "ex-3", firstName: "Laurent", lastName: "Exemple", age: 41, ranking: "15/4", bestRanking: "15/1", bio: "", paused: true, slots: [] },
  { id: "ex-4", firstName: "Matthieu", lastName: "Exemple", age: 29, ranking: "15", bestRanking: "5/6", bio: "Préparation physique et mental de match, pour progresser en compétition.", paused: false, slots: [{ weekday: 1, date: null, start: "17:00", end: "20:00" }, { weekday: 3, date: null, start: "17:00", end: "20:00" }, { weekday: 5, date: null, start: "10:00", end: "13:00" }] },
];

// Pastille d'information (âge, classement…)
const Fact = ({ k, v }: { k: string; v: string }) => <div className="rounded-xl bg-sand px-3 py-1.5 text-sm"><b className="block text-[0.7rem] font-bold uppercase tracking-wider text-clay">{k}</b>{v}</div>;

// Bandeau « terre battue » avec la balle et les étapes de la réservation
export const DAY_STEPS = ["Professeur", "Heure", "Ton cours"]; // quand le jour est déjà choisi dans le calendrier
export function ClayHero({ title, text, step, labels }: { title: string; text: string; step: 1 | 2 | 3; labels?: string[] }) {
  return (
    <header className="relative overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-clay to-clay-dark p-5 text-white sm:p-6">
      <span aria-hidden="true" className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-ball opacity-90" />
      <span aria-hidden="true" className="absolute right-4 top-2 h-28 w-28 rounded-full border-[3px] border-white/70 border-x-transparent" />
      <h3 className="relative m-0 text-2xl font-black text-white sm:text-3xl">{title}</h3>
      <p className="relative m-0 mt-1 max-w-[80%] text-white/95">{text}</p>
      <ol className="relative m-0 mt-3 flex list-none flex-wrap gap-2 p-0" aria-label="Étapes de la réservation">
        {(labels ?? ["Professeur", "Objectif", "Créneau"]).map((x, i) => <li key={x} aria-current={step === i + 1 ? "step" : undefined} className={"rounded-full px-3 py-1 text-sm font-bold " + (step === i + 1 ? "bg-ball text-ink" : "bg-white/20 text-white")}>{["①", "②", "③"][i]} {x}</li>)}
      </ol>
    </header>
  );
}

const dayOfIso = (iso: string) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;

const shortSlot = (x: { date: string; time: string }) => {
  const d = new Date(`${x.date}T12:00:00`); const w = d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${d.getDate()} · ${hour(x.time)}`;
};
const ROWS = 6; // la carte a 6 « lignes » partagées avec ses voisines (sous-grille) : les textes sont donc à la MÊME hauteur d'une carte à l'autre

// Carte d'un professeur (version « carte de joueur ») : bandeau terre battue, classements, jours disponibles en toutes lettres, prochains créneaux libres, tarif, bouton pour choisir.
// À mettre dans une grille `.prof-grid` : chaque carte occupe 6 lignes de la grille, alignées entre les cartes.
export function ProfCardView({ p, onPick, preview, price, selected }: { p: ProfCard; onPick?: (p: ProfCard) => void; preview?: boolean; price?: number; selected?: boolean }) {
  const name = profName(p);
  const weekly = [...new Set(p.slots.flatMap((s) => (s.weekday !== null ? [s.weekday] : [])))].sort((a, b) => a - b); // seulement les jours disponibles, en toutes lettres
  const allWeek = weekly.length === 7; // tous les jours : Lun Mar Mer Jeu Ven Sam Dim
  const dates = [...new Set(p.slots.flatMap((s) => (s.date ? [s.date] : [])))].sort();
  const pad = "px-3";
  const label = "m-0 text-[0.65rem] font-black uppercase tracking-[0.12em] text-muted";
  const free = p.freeThisWeek ?? 0;
  const facts = [p.age !== null ? `${p.age} ans` : "", p.ranking ? `classement ${p.ranking}` : "", p.bestRanking ? `meilleur ${p.bestRanking}` : ""].filter(Boolean).join(" · ");
  return (
    <article className={"prof-card mb-3 grid min-w-0 gap-y-0 overflow-hidden rounded-2xl border-2 bg-white " + (selected ? "border-clay shadow-[0_5px_0_var(--color-clay)]" : "border-line")} style={{ gridRow: `span ${ROWS}`, gridTemplateRows: "subgrid" }} aria-label={`Professeur : ${name}`}>
      {/* 1 · petit bandeau + avatar + prix */}
      <div className="relative">
        <div className="relative h-12 overflow-hidden bg-gradient-to-br from-clay to-clay-dark" aria-hidden="true">
          <span className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 40px),repeating-linear-gradient(0deg,#fff 0 2px,transparent 2px 40px)" }} />
          <span className="absolute right-3 top-2 h-6 w-6 rounded-full bg-ball shadow-[0_2px_0_#b3925a]" />
        </div>
        <div className={"flex items-end justify-between gap-2 " + pad}>
          <span className="relative z-10 -mt-6 rounded-full ring-2 ring-ball"><span className="block rounded-full ring-2 ring-white"><Avatar name={name} size={48} /></span></span>
          {price ? <div className="pb-0.5 text-right leading-tight"><b className="font-display text-2xl font-black text-clay">{price} €</b><small className="ml-1 text-xs text-muted">la séance</small></div> : null}
        </div>
      </div>
      {/* 2 · nom, âge et classements sur deux lignes */}
      <div className={pad + " pt-1.5"}><h3 className="m-0 text-lg leading-tight">{name}</h3><small className="block text-muted">{facts || "Professeur du club"}</small></div>
      {/* 3 · état */}
      <div className={pad + " pt-1.5"}>{p.paused ? <span className="inline-block rounded-full bg-[#fff3cd] px-2.5 py-0.5 text-xs font-bold text-[#7a5a00]">⏸ Ne prend plus de demandes</span> : free > 0 ? <span className="inline-block rounded-full bg-[#dff3e8] px-2.5 py-0.5 text-xs font-bold text-[#1c6b42]">● {free} créneau{free > 1 ? "x" : ""} libre{free > 1 ? "s" : ""} cette semaine</span> : <span className="inline-block rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold">{(p.nextFree?.length ?? 0) > 0 ? "Prochains créneaux ci-dessous" : p.slots.length ? "Pas de créneau libre pour le moment" : "Aucune disponibilité indiquée"}</span>}</div>
      {/* 4 · présentation (2 lignes au plus) */}
      <div className={pad + " pt-1.5"}>{p.bio && <p className="m-0 line-clamp-2 text-sm italic">« {p.bio} »</p>}</div>
      {/* 5 · jours disponibles + prochains créneaux libres */}
      <div className={pad + " pt-2"}>
        <p className={label}>Disponible le</p>
        <div className="mt-1 flex flex-wrap gap-1" aria-label="Jours où il est disponible">{weekly.map((d) => <span key={d} className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">{allWeek ? WEEKDAYS[d].slice(0, 3) : WEEKDAYS[d]}</span>)}{allWeek && <span className="rounded-full bg-ball px-2 py-0.5 text-xs font-bold text-ink">Tous les jours</span>}{dates.map((d) => <span key={d} className="rounded-full border-2 border-ink px-2 py-0 text-xs font-bold text-ink">{new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>)}{weekly.length + dates.length === 0 && <span className="text-xs text-muted">Aucune pour le moment</span>}</div>
        <p className={label + " mt-2"}>Prochains créneaux libres</p>
        <div className="mt-1 flex flex-wrap gap-1">{(p.nextFree ?? []).map((x) => <span key={x.date + x.time} className="rounded-lg border-2 border-[#b7dfc8] bg-[#e3f4ea] px-2 py-0 text-xs font-bold text-[#1c6b42]">{shortSlot(x)}</span>)}{(p.nextFree ?? []).length === 0 && <span className="text-xs text-muted">—</span>}</div>
      </div>
      {/* 6 · bouton */}
      <div className={pad + " pb-3 pt-3"}>
        {onPick ? <button className={"btn w-full !h-auto min-h-10 text-sm shadow-[0_3px_0_rgba(0,0,0,0.18)] " + (p.paused ? "bg-[#e5e0d8] text-[#6b6358] shadow-none" : selected ? "bg-ok text-white hover:bg-[#25794c]" : "bg-clay text-white hover:bg-clay-dark")} disabled={p.paused} onClick={() => onPick(p)}>{p.paused ? "Indisponible" : selected ? "✔ Choisi" : `Choisir ${p.firstName ?? "ce professeur"} →`}</button> : null}
        {preview && onPick && <small className="hint mt-1 block text-center">(aperçu)</small>}
      </div>
    </article>
  );
}

// Rappel des tarifs (fixés par le club) : jamais de paiement sur le site
export function PriceNote({ yourPrice }: { yourPrice?: number | null }) {
  return (
    <p className="m-0 rounded-2xl bg-sand p-3 text-sm">💶 <strong>Tarif d'une séance :</strong> {PRICE_MEMBER} € pour un adhérent du TC Houdan, {PRICE_OTHER} € pour les autres (+ {SUNDAY_EXTRA} € le dimanche).{yourPrice ? <> Ton tarif : <strong>{yourPrice} €</strong>.</> : null} Le règlement se fait directement avec le professeur : rien ne se paie sur le site.</p>
  );
}

// Choix du professeur (adulte) : liste, filtre par jour, tarif
export function ProfChooser({ preview, date, onPick, onClose }: { preview: boolean; date?: string; onPick: (p: ProfCard, price: number) => void; onClose: () => void }) {
  const { me, reload } = useAuth();
  const [profs, setProfs] = useState<ProfCard[] | null>(preview ? withExampleFree(EXAMPLE_PROFS) : null);
  const [yourPrice, setYourPrice] = useState<number>(PRICE_OTHER);
  const [pvMember, setPvMember] = useState(false); // aperçu : on peut cocher / décocher pour voir le tarif changer (rien n'est enregistré)
  const [day, setDay] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [asked, setAsked] = useState(false); // depuis un jour : 1re carte « adhérent ou non ? » avant le choix du professeur
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
  const dayRows = useDayAvailability(preview, date); // si un jour est déjà choisi : les créneaux libres de chaque professeur CE jour-là
  const yp = preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice;
  async function answerMember(v: boolean) { if (!preview && !!me?.clubMember === v) { setAsked(true); return; } await toggleMember(v); setAsked(true); }
  if (date && !asked) return (
    <section className="grid gap-4 rounded-3xl border-2 border-clay bg-white p-4 shadow-sm sm:p-6" aria-label="Es-tu adhérent du TC Houdan ?">
      <div className="flex items-center justify-between gap-2"><button type="button" className="border-0 bg-transparent p-0 text-sm font-bold text-ink underline" onClick={onClose}>← Retour au calendrier</button><small className="font-bold text-muted">Étape 1 sur 4 · {dayLong(date)}</small></div>
      <h3 className="m-0 font-display text-xl">Es-tu adhérent du TC Houdan ?</h3>
      <p className="m-0 text-sm text-muted">Cela change le tarif de la séance : {PRICE_MEMBER} € pour un adhérent, {PRICE_OTHER} € pour les autres (+ {SUNDAY_EXTRA} € le dimanche). Tu règles directement au professeur.</p>
      <Err msg={err} />
      <div className="grid gap-3 sm:grid-cols-2">
        {([[true, "✅ Oui, je suis adhérent", `${priceOn(PRICE_MEMBER, date)} € la séance`], [false, "🙋 Non, pas adhérent", `${priceOn(PRICE_OTHER, date)} € la séance`]] as const).map(([v, t, sub]) => (
          <button key={String(v)} type="button" onClick={() => answerMember(v)} aria-pressed={member === v} className={"grid gap-1 rounded-2xl border-2 p-4 text-left transition-colors " + (member === v ? "border-clay bg-[#fdf1ea]" : "border-line bg-white hover:border-clay/60")}><strong className="font-display text-lg">{t}</strong><small className="text-muted">{sub}</small></button>))}
      </div>
    </section>
  );
  return (
    <section className="grid gap-4 rounded-3xl border-2 border-clay bg-chalk p-3 shadow-sm sm:p-4" aria-label="Choisir mon professeur">
      {date ? <div className="flex items-center justify-between gap-2"><button type="button" className="border-0 bg-transparent p-0 text-sm font-bold text-ink underline" onClick={() => setAsked(false)}>← Retour</button><small className="font-bold text-muted">Étape 2 sur 4 · {dayLong(date)}</small></div> : null}
      {date ? <h3 className="m-0 font-display text-xl">Quel professeur ?</h3> : <ClayHero labels={undefined} title="Réserver un cours particulier" text="Choisis ton professeur, puis le créneau qui t'arrange. On réserve au plus tard 24 h avant le cours. Ton professeur confirme ensuite (sous 48 h)." step={1} />}
      {date ? <p className="m-0 text-sm text-muted">{member ? "Tarif adhérent." : "Tarif non adhérent."} Tu vois pour chacun son niveau, sa présentation et ses heures libres ce jour-là. Ton professeur confirme ensuite (sous 48 h).</p> : <>
      <div className="flex justify-end"><button className="btn-outline btn-sm" onClick={onClose}>Annuler</button></div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-white px-3 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
        <input type="checkbox" className="h-5 w-5 accent-clay" checked={member} onChange={(e) => toggleMember(e.target.checked)} />Je suis adhérent du TC Houdan
      </label>
      <PriceNote yourPrice={preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice} /></>}
      <Err msg={err} />
      {!date && <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par jour">
        {[null, ...WEEKDAYS.map((_, i) => i)].map((d) => <button key={d ?? "all"} className={"rounded-full border-2 px-4 py-1.5 text-sm font-bold " + (day === d ? "border-ink bg-ink text-white" : "border-ink bg-white text-ink")} aria-pressed={day === d} onClick={() => setDay(d)}>{d === null ? "Tous" : WEEKDAYS[d]}</button>)}
      </div>}
      {date ? (
        dayRows === null ? <div className="skeleton h-32" role="status" aria-label="Chargement en cours" /> : dayRows.length === 0 ? <Empty>Aucun professeur n'est visible pour le moment.</Empty> : (
          <div className="prof-grid grid gap-x-4 gap-y-0 md:grid-cols-3">{dayRows.map((r) => (
            <article key={r.prof.id} aria-label={`Professeur : ${profName(r.prof)}`} className="mb-4 grid min-w-0 gap-y-3 rounded-3xl border-2 border-line bg-white p-4 shadow-sm" style={{ gridRow: "span 6", gridTemplateRows: "subgrid" }}>
              <div className="flex items-center gap-3"><Avatar name={profName(r.prof)} /><strong className="font-display text-xl leading-tight">{profName(r.prof)}</strong></div>
              <small className="text-muted">{[r.prof.age ? `${r.prof.age} ans` : "", r.prof.ranking ? `classement ${r.prof.ranking}` : "", r.prof.bestRanking ? `meilleur classement ${r.prof.bestRanking}` : ""].filter(Boolean).join(" · ") || "Professeur du club"}</small>
              <p className="m-0 line-clamp-4 text-sm">{r.prof.bio || <span className="text-muted">Pas de présentation écrite.</span>}</p>
              <p className="m-0 font-display text-3xl font-black">{priceOn(yp, date)} € <small className="text-sm font-bold text-muted">{member ? "ton tarif adhérent" : "la séance"}</small></p>
              <div className="flex flex-wrap content-start items-start gap-1.5"><small className="w-full font-bold text-muted">{r.free.length ? `${r.free.length} créneau${r.free.length > 1 ? "x" : ""} libre${r.free.length > 1 ? "s" : ""} ce jour` : "Complet ce jour-là"}</small>{r.free.map((t) => <span key={t} className="h-fit rounded-lg border-2 border-[#bbe5c8] bg-[#e8f7ee] px-2.5 py-1 text-sm font-extrabold text-[#166534]">{t.slice(0, 2).replace(/^0/, "")} h</span>)}</div>
              <button className={(r.free.length ? "btn-clay" : "btn-outline") + " self-end"} disabled={!r.free.length} onClick={() => onPick(r.prof, yp)}>{r.free.length ? `Choisir ${r.prof.firstName ?? "ce professeur"} →` : "Complet ce jour-là"}</button>
            </article>
          ))}</div>
        )
      ) : profs === null ? <div className="skeleton h-32" role="status" aria-label="Chargement en cours" /> : shown.length === 0 ? <Empty>{profs.length === 0 ? "Aucun professeur n'est visible pour le moment." : "Aucun professeur n'est disponible ce jour-là."}</Empty> : (
        <div className="prof-grid grid gap-x-3 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">{shown.map((p) => <ProfCardView key={p.id} p={p} preview={preview} price={preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice} onPick={(x) => onPick(x, preview ? (pvMember ? PRICE_MEMBER : PRICE_OTHER) : yourPrice)} />)}</div>
      )}
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
        <p className="hint m-0">Tu crées les comptes dans <strong>Jeunes · Centre de compétition → 👥 Entraîneurs</strong> ; c'est l'entraîneur qui clique « Je souhaite donner des cours particuliers » dans son espace. Un professeur n'est visible des adultes que si les <strong>3 documents</strong> sont déposés, que la <strong>carte professionnelle est valable</strong> et que <strong>tu l'as validé</strong> ici. Si un document est remplacé, tu dois revalider. Le site ne peut pas vérifier la carte auprès de l'administration : c'est à toi de contrôler les pièces.</p>
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

// Aperçu du coach : créneaux libres calculés avec les disponibilités d'exemple
function withExampleFree(list: ProfCard[]): ProfCard[] {
  const limit = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  return list.map((p) => {
    if (p.paused) return { ...p, nextFree: [], freeThisWeek: 0 };
    const free = previewPlanning(p.slots).flatMap((d) => d.slots.filter((x) => x.free).map((x) => ({ date: d.date, time: x.time })));
    return { ...p, nextFree: free.slice(0, 3), freeThisWeek: free.filter((x) => x.date <= limit).length };
  });
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
                  <small className={"block text-[0.65rem] font-bold uppercase tracking-wider sm:text-xs " + (now ? "text-champagne" : "text-muted")}>{DAY_NAMES[k]}</small>
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
