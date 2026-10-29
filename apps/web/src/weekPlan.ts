// Cours du club d'un entraîneur : tous les horaires sont des MINUTES depuis minuit (9 h 30 = 570), jamais des heures écrites.
// La DURÉE dépend du type de cours (jamais de la hauteur dessinée) ; la fin = début + durée.
export type CourseKind = "ADULTES" | "COMPETITION" | "ECOLE";
export const DAY_START = 9 * 60; // le planning commence à 9 h
export const DAY_END = 22 * 60; // et finit à 22 h
export const STEP = 30; // on démarre un cours à l'heure ou à la demi-heure
export const DURATION: Record<CourseKind, number> = { ADULTES: 90, COMPETITION: 90, ECOLE: 90 };

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
// Arrondi à la demi-heure la plus proche (pile entre deux : la demi-heure suivante)
export const snap = (m: number) => Math.round(m / STEP) * STEP;
export const endOf = (start: number, kind: CourseKind) => start + DURATION[kind];
// « 9 h », « 9 h 30 » (affichage dans les cours) et « 9 h 00 » (axe de gauche)
export const hm = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
export const hmFull = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;

export interface PlanBlock { id: string; weekday: number; start: number; end: number; kind?: CourseKind; label: string }

// Un cours peut-il occuper [start, end[ ce jour-là ? (hors planning ou chevauchement : on dit pourquoi)
export function check(blocks: PlanBlock[], weekday: number, start: number, end: number, ignoreId?: string): { ok: true } | { ok: false; reason: string } {
  if (start < DAY_START || end > DAY_END) return { ok: false, reason: `Ce cours (${hm(start)} – ${hm(end)}) dépasse les horaires du planning (${hm(DAY_START)} – ${hm(DAY_END)}).` };
  const other = blocks.find((b) => b.id !== ignoreId && b.weekday === weekday && b.start < end && b.end > start);
  if (other) return { ok: false, reason: `Ce cours (${hm(start)} – ${hm(end)}) chevauche « ${other.label || "un cours"} » (${hm(other.start)} – ${hm(other.end)}).` };
  return { ok: true };
}
// Les cours qui se chevauchent déjà entre eux (anciennes données) : leurs identifiants
export function clashing(blocks: PlanBlock[]): Set<string> {
  const s = new Set<string>();
  for (const a of blocks) for (const b of blocks) if (a.id < b.id && a.weekday === b.weekday && a.start < b.end && a.end > b.start) { s.add(a.id); s.add(b.id); }
  return s;
}
