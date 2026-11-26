import { CourseDay, fmtDuration, minutesBetween, perWeek, WEEKDAYS, Group, WEEKS } from "../progression";

const HOURS = Array.from({ length: 29 }, (_, k) => { const m = 8 * 60 + k * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`; });

// Jours et horaires du cours : 1, 2 ou 3 entraînements par semaine
export function Schedule({ days, onChange }: { days: CourseDay[]; onChange: (d: CourseDay[]) => void }) {
  const set = (i: number, p: Partial<CourseDay>) => onChange(days.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const free = WEEKDAYS.filter((d) => !days.some((x) => x.d === d));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">Jours et horaires du cours</span>
        <span className="text-sm text-muted">{days.length ? `${days.length} entraînement${days.length > 1 ? "s" : ""} par semaine` : "1 à 3 par semaine"}</span></div>
      {days.map((x, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-paper p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-center">
          <select className="input col-span-2 sm:col-span-1" aria-label={`Jour ${i + 1}`} value={x.d} onChange={(e) => set(i, { d: e.target.value })}>{[x.d, ...free].map((d) => <option key={d}>{d}</option>)}</select>
          <select className="input" aria-label="Début" value={x.from} onChange={(e) => { const from = e.target.value; set(i, { from, to: minutesBetween(from, x.to) > 0 ? x.to : HOURS[Math.min(HOURS.length - 1, HOURS.indexOf(from) + 2)] }); }}>{HOURS.slice(0, -1).map((h) => <option key={h} value={h}>de {h.replace(":", " h ").replace(" 00", "")}</option>)}</select>
          <select className="input" aria-label="Fin" value={x.to} onChange={(e) => set(i, { to: e.target.value })}>{HOURS.filter((h) => minutesBetween(x.from, h) > 0).map((h) => <option key={h} value={h}>à {h.replace(":", " h ").replace(" 00", "")}</option>)}</select>
          <span className="text-sm text-muted sm:text-left">{fmtDuration(minutesBetween(x.from, x.to))}</span>
          <button type="button" className="btn-outline btn-sm" aria-label={`Retirer le jour ${x.d}`} onClick={() => onChange(days.filter((_, k) => k !== i))}>Retirer</button>
        </div>))}
      {days.length < 3 && free.length > 0 && <div><button type="button" className="btn-outline btn-sm" onClick={() => onChange([...days, { d: free[0], from: "17:00", to: "18:00" }])}>＋ {days.length ? "Un autre jour (2e ou 3e entraînement)" : "Ajouter un jour de cours"}</button></div>}
    </div>
  );
}

export const planSummary = (g: Group) => `${WEEKS} semaines × ${perWeek(g)} séance${perWeek(g) > 1 ? "s" : ""} = ${WEEKS * perWeek(g)} séances`;
