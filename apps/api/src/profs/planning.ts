// Planning d'un professeur : ses disponibilités découpées en créneaux d'UNE HEURE, sur les 28 prochains jours, moins ce qui est déjà pris.
export const SLOT_MINUTES = 60;
export const NOTICE_HOURS = 12; // on ne réserve pas un cours qui commence dans moins de 12 h
export const HORIZON_DAYS = 28;

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dayNumber = (d: string) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);
export const addDays = (d: string, n: number) => new Date((dayNumber(d) + n) * 86_400_000).toISOString().slice(0, 10);
export const weekdayOf = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche

// Date et heure d'aujourd'hui à Paris (les créneaux sont des heures « murales » du club)
export function nowParis(now = new Date()) {
  const s = now.toLocaleString("sv-SE", { timeZone: "Europe/Paris" }); // « 2026-10-22 18:05:09 »
  return { date: s.slice(0, 10), minutes: toMin(s.slice(11, 16)) };
}

export interface AvailSlot { weekday: number | null; date: string | null; start: string; end: string }
export interface Busy { date: string; time: string }
export interface PlanDay { date: string; slots: { time: string; end: string; free: boolean }[] }

// Deux cours d'une heure se chevauchent s'ils commencent à moins d'une heure d'écart
export const overlaps = (a: string, b: string) => Math.abs(toMin(a) - toMin(b)) < SLOT_MINUTES;

// 18:00 → 20:00 donne 18:00 et 19:00 (un créneau incomplet n'est pas proposé)
export function hourlyStarts(start: string, end: string): string[] {
  const out: string[] = [];
  for (let m = toMin(start); m + SLOT_MINUTES <= toMin(end); m += SLOT_MINUTES) out.push(fromMin(m));
  return out;
}

export function buildPlanning(avail: AvailSlot[], busy: Busy[], now = nowParis()): PlanDay[] {
  const days: PlanDay[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const date = addDays(now.date, i);
    const wd = weekdayOf(date);
    const starts = new Set<string>();
    for (const a of avail) if ((a.weekday !== null && a.weekday === wd) || (a.date !== null && a.date === date)) hourlyStarts(a.start, a.end).forEach((s) => starts.add(s));
    const slots = [...starts].sort()
      .filter((s) => i * 1440 + toMin(s) - now.minutes >= NOTICE_HOURS * 60)
      .map((s) => ({ time: s, end: fromMin(toMin(s) + SLOT_MINUTES), free: !busy.some((b) => b.date === date && overlaps(b.time, s)) }));
    if (slots.length) days.push({ date, slots });
  }
  return days;
}
