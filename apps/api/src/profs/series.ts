import { HOLIDAYS_ZONE_C } from "../players/school-days";
import { addDays } from "./planning";

// Un créneau pris « à l'année » : chaque semaine, à la même heure, jusqu'à la fin de la saison (30 juin).
export const seasonEnd = (from: string) => {
  const y = Number(from.slice(0, 4));
  return from <= `${y}-06-30` ? `${y}-06-30` : `${y + 1}-06-30`;
};

// Jours fériés français (fixes + Pâques, Ascension, Pentecôte)
export function publicHolidays(year: number): Map<string, string> {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const out = new Map<string, string>();
  for (const [md, name] of [["01-01", "jour de l'an"], ["05-01", "fête du travail"], ["05-08", "8 mai"], ["07-14", "14 juillet"], ["08-15", "15 août"], ["11-01", "Toussaint"], ["11-11", "11 novembre"], ["12-25", "Noël"]]) out.set(`${year}-${md}`, name);
  out.set(addDays(easter, 1), "lundi de Pâques"); out.set(addDays(easter, 39), "Ascension"); out.set(addDays(easter, 50), "lundi de Pentecôte");
  return out;
}

export interface SeriesDate { date: string; skip?: string }

// Toutes les semaines à partir de `start` (comprise) jusqu'au 30 juin : les vacances scolaires (zone C) et les jours fériés sont sautés
export function seriesDates(start: string): SeriesDate[] {
  const end = seasonEnd(start), out: SeriesDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) {
    const vac = HOLIDAYS_ZONE_C.find((x) => d >= x.from && d <= x.to);
    const fer = publicHolidays(Number(d.slice(0, 4))).get(d);
    out.push({ date: d, skip: vac ? `vacances scolaires (${vac.name})` : fer ? `jour férié (${fer})` : undefined });
  }
  return out;
}
