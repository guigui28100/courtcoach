import { addDays } from "./planning";
import { offDay } from "./holidays";

// Un créneau pris « à l'année » : chaque semaine, à la même heure, jusqu'à la fin de la saison (30 juin).
export const seasonEnd = (from: string) => {
  const y = Number(from.slice(0, 4));
  return from <= `${y}-06-30` ? `${y}-06-30` : `${y + 1}-06-30`;
};

export interface SeriesDate { date: string; skip?: string }

// Toutes les semaines à partir de `start` (comprise) jusqu'au 30 juin. Si le professeur ne travaille pas pendant les vacances (`skipHolidays`), les vacances scolaires (zone C) et les jours fériés sont sautés.
export function seriesDates(start: string, skipHolidays = true): SeriesDate[] {
  const end = seasonEnd(start), out: SeriesDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) out.push({ date: d, skip: skipHolidays ? offDay(d) : undefined });
  return out;
}
