// Calendrier « Mes cours à venir » de l'adulte : on touche un cours pour le voir ou l'annuler, un jour sans cours pour y réserver.
import { ReactNode, useEffect, useMemo, useState } from "react";
import { get } from "../api";
import { Lesson, PlanDay, ProfCard, profName, todayIso } from "../types";
import { EXAMPLE_PROFS, previewPlanning } from "./Profs";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const hourOf = (t: string) => (t.slice(3, 5) === "00" ? `${Number(t.slice(0, 2))} h` : `${Number(t.slice(0, 2))} h ${t.slice(3, 5)}`);
export const dayLong = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

// Petite fenêtre au-dessus de la page (Échap ou la croix pour fermer)
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="relative grid w-full max-w-md gap-3 rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-3 text-2xl font-black text-muted hover:text-ink" aria-label="Fermer" onClick={onClose}>✕</button>
        <h3 className="m-0 pr-8 font-display text-2xl first-letter:uppercase">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const TONE = { ACCEPTED: "bg-[#15803d] text-white", BOOKED: "border-2 border-[#e0b100] bg-[#fff1c2] text-[#7a5a00]", REFUSED: "bg-[#fde8e8] text-[#b42318] line-through" } as const;
const MARK = { ACCEPTED: "✔", BOOKED: "⏳", REFUSED: "✖" } as const;

export function CourseCalendar({ lessons, onLesson, onDay }: { lessons: Lesson[]; onLesson: (l: Lesson) => void; onDay: (date: string) => void }) {
  const shown = useMemo(() => lessons.filter((l) => l.finalSlot && (l.status === "ACCEPTED" || l.status === "BOOKED" || l.status === "REFUSED")), [lessons]);
  const first = shown.filter((l) => l.status !== "REFUSED" && l.finalSlot!.date >= todayIso()).sort((a, b) => a.finalSlot!.date.localeCompare(b.finalSlot!.date))[0];
  const [month, setMonth] = useState((first?.finalSlot?.date ?? todayIso()).slice(0, 7));
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const step = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: nd }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const today = todayIso();
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-center gap-3">
        <button className="grid size-10 place-items-center rounded-full border-2 border-line bg-white text-xl font-black hover:border-ink" aria-label="Mois précédent" onClick={() => step(-1)}>‹</button>
        <strong className="min-w-[11rem] text-center font-display text-xl capitalize">{MONTHS[m - 1]} {y}</strong>
        <button className="grid size-10 place-items-center rounded-full border-2 border-line bg-white text-xl font-black hover:border-ink" aria-label="Mois suivant" onClick={() => step(1)}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-muted sm:gap-2 sm:text-xs">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const here = shown.filter((l) => l.finalSlot!.date === d);
          const free = here.length === 0 && d > today;
          const weekend = i % 7 >= 5;
          return (
            <div key={d} role={free ? "button" : undefined} tabIndex={free ? 0 : undefined} aria-label={free ? `${dayLong(d)} : aucun cours, réserver` : undefined}
              onClick={() => free && onDay(d)} onKeyDown={(e) => free && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onDay(d))}
              className={"min-h-[4.5rem] rounded-xl border-2 p-1.5 sm:min-h-[5.5rem] sm:rounded-2xl sm:p-2 " + (d === today ? "border-clay bg-[#fff6ef] " : weekend ? "border-[#a89c88] bg-[#f1e8d9] " : "border-[#a89c88] bg-white ") + (free ? "cursor-pointer hover:border-clay hover:shadow-md" : d < today ? "opacity-60" : "")}>
              <b className={"text-sm " + (d === today ? "text-clay" : "")}>{Number(d.slice(8))}</b>
              {free && <span aria-hidden="true" className="mt-1 block text-center text-lg font-black text-clay/50">＋</span>}
              <div className="mt-1 grid gap-1">
                {here.map((l) => (
                  <button key={l.id} type="button" onClick={(e) => { e.stopPropagation(); onLesson(l); }} aria-label={`${dayLong(d)}, ${hourOf(l.finalSlot!.time)} : voir le cours`} className={"rounded-lg px-1 py-0.5 text-left text-[0.65rem] font-extrabold leading-tight sm:px-1.5 sm:py-1 sm:text-xs " + TONE[l.status as keyof typeof TONE]}>
                    <span aria-hidden="true">{MARK[l.status as keyof typeof MARK]} </span>{(l.seriesCount ?? 0) > 1 && "🔁 "}{hourOf(l.finalSlot!.time)}<span className="hidden sm:inline"> {l.prof?.firstName ?? ""}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-muted"><span>🟩 Confirmé</span><span>🟨 Le professeur doit confirmer</span><span>🟥 Refusé</span><span>🔁 chaque semaine</span><span>＋ Jour libre : touche-le pour réserver</span></p>
    </div>
  );
}

// Fiche d'un cours (on touche une étiquette du calendrier)
export function LessonSheet({ l, onClose, onCancel }: { l: Lesson; onClose: () => void; onCancel?: (l: Lesson, series?: boolean) => void }) {
  const slot = l.finalSlot!;
  const serie = (l.seriesCount ?? 0) > 1;
  const state = l.status === "ACCEPTED" ? ["✅ Confirmé par le professeur", "text-ok"] : l.status === "BOOKED" ? ["⏳ Le professeur doit confirmer (sous 48 h)", "text-[#7a5a00]"] : ["❌ Refusé ou annulé", "text-bad"];
  const Row = ({ i, children }: { i: string; children: ReactNode }) => <p className="m-0 flex items-center gap-3 font-bold"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand text-lg">{i}</span><span>{children}</span></p>;
  return (
    <Sheet title={dayLong(slot.date)} onClose={onClose}>
      <p className="m-0 text-muted">Ton cours particulier{serie ? " · 🔁 chaque semaine" : ""}</p>
      <Row i="🕕">{hourOf(slot.time)} – {hourOf(`${String(Number(slot.time.slice(0, 2)) + 1).padStart(2, "0")}:${slot.time.slice(3, 5)}`)}</Row>
      <Row i="👨‍🏫">avec {l.prof?.firstName ?? "ton professeur"}</Row>
      {l.place && <Row i="🎾">{l.place}</Row>}
      <Row i="🎯">{l.objective}{l.type === "duo" ? " · cours à deux" : ""}</Row>
      {l.price ? <Row i="💶">{l.price} € à régler directement avec le professeur</Row> : null}
      <Row i="ℹ️"><span className={state[1]}>{state[0]}</span></Row>
      <div className="mt-2 flex flex-wrap gap-2">
        {onCancel && l.status !== "REFUSED" && <button className="rounded-xl border-2 border-bad px-4 py-2.5 font-extrabold text-bad hover:bg-bad hover:text-white" onClick={() => { onClose(); onCancel(l); }}>{l.status === "BOOKED" ? "Retirer ma demande" : "Annuler ce cours"}</button>}
        {onCancel && serie && l.status !== "REFUSED" && <button className="rounded-xl border-2 border-bad px-4 py-2.5 font-extrabold text-bad hover:bg-bad hover:text-white" onClick={() => { onClose(); onCancel(l, true); }}>Arrêter toute la série</button>}
        <button className="rounded-xl border-2 border-ink px-4 py-2.5 font-extrabold hover:bg-ink hover:text-white" onClick={onClose}>Fermer</button>
      </div>
    </Sheet>
  );
}

// Les créneaux libres de chaque professeur pour UN jour (fiche d'un jour libre + choix du professeur)
export type DayRow = { prof: ProfCard; free: string[]; taken: number };
export function useDayAvailability(preview: boolean, date: string | undefined) {
  const [rows, setRows] = useState<DayRow[] | null>(null);
  useEffect(() => {
    if (!date) { setRows(null); return; }
    let live = true; setRows(null);
    const rowOf = (prof: ProfCard, days: PlanDay[]): DayRow => { const d = days.find((x) => x.date === date); return { prof, free: (d?.slots ?? []).filter((s) => s.free).map((s) => s.time), taken: (d?.slots ?? []).filter((s) => !s.free).length }; };
    (async () => {
      try {
        const profs = preview ? EXAMPLE_PROFS : (await get<{ profs: ProfCard[] }>("/profs")).profs;
        const out = await Promise.all(profs.filter((p) => !p.paused).map(async (p) => {
          try { return rowOf(p, preview ? previewPlanning(p.slots) : (await get<{ days: PlanDay[] }>(`/profs/${p.id}/planning`)).days); } catch { return rowOf(p, []); }
        }));
        if (live) setRows(out);
      } catch { if (live) setRows([]); }
    })();
    return () => { live = false; };
  }, [preview, date]);
  return rows;
}

// Fiche d'un jour sans cours : qui a de la place ce jour-là ?
export function DaySheet({ date, preview, onClose, onReserve }: { date: string; preview: boolean; onClose: () => void; onReserve: () => void }) {
  const rows = useDayAvailability(preview, date);
  const any = !!rows?.some((r) => r.free.length);
  return (
    <Sheet title={dayLong(date)} onClose={onClose}>
      <p className="m-0 text-muted">Aucun cours ce jour-là.</p>
      {rows === null ? <div className="skeleton h-20" role="status" aria-label="Chargement en cours" /> : rows.length === 0 ? <p className="m-0 font-bold">Aucun professeur n'est visible pour le moment.</p> : rows.map((r) => (
        <p key={r.prof.id} className="m-0 flex items-center gap-3 font-bold"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand text-lg">👨‍🏫</span><span>{profName(r.prof)} : {r.free.length ? `${r.free.length} créneau${r.free.length > 1 ? "x" : ""} libre${r.free.length > 1 ? "s" : ""}` : <span className="text-muted">complet ce jour-là</span>}</span></p>
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-clay" disabled={!any} onClick={onReserve}>Réserver ce jour-là →</button>
        <button className="rounded-xl border-2 border-ink px-4 py-2.5 font-extrabold hover:bg-ink hover:text-white" onClick={onClose}>Fermer</button>
      </div>
    </Sheet>
  );
}

// Les heures d'UN jour pour le professeur choisi : on touche une case verte pour bloquer le créneau
export function DayHours({ day, value, onChange }: { day: PlanDay | undefined; value: { date: string; time: string } | null; onChange: (v: { date: string; time: string } | null) => void }) {
  if (!day) return null;
  return (
    <div className="grid gap-2 rounded-3xl bg-white p-3 ring-1 ring-line sm:p-4">
      <strong className="text-center font-display text-lg first-letter:uppercase">{dayLong(day.date)}</strong>
      <ul className="m-0 grid list-none gap-2 p-0" aria-label="Les heures de ce jour">
        {day.slots.map((s) => {
          const on = value?.date === day.date && value.time === s.time;
          return (
            <li key={s.time} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
              <span className="text-right font-display text-lg font-bold text-muted">{hourOf(s.time)}</span>
              {s.free ? (
                <button type="button" aria-pressed={on} aria-label={`${hourOf(s.time)} : libre`} onClick={() => onChange(on ? null : { date: day.date, time: s.time })}
                  className={"min-h-12 rounded-xl border-2 px-3 font-extrabold " + (on ? "border-[#0f5f2d] bg-[#15803d] text-white shadow-md" : "border-[#bbe5c8] bg-[#e8f7ee] text-[#166534] hover:border-[#15803d]")}>{on ? "✔ Mon choix" : "Libre"}</button>
              ) : (
                <span className="grid min-h-12 place-items-center rounded-xl border-2 border-[#e3dccd] bg-[repeating-linear-gradient(45deg,#f1ede4,#f1ede4_6px,#e7e0d1_6px,#e7e0d1_12px)] font-extrabold text-muted">Pris</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
