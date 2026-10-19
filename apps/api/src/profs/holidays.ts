import { HOLIDAYS_ZONE_C } from "../players/school-days";

const addDays = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + n * 86_400_000).toISOString().slice(0, 10);

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

// Phrase si ce jour est en vacances scolaires (zone C) ou férié, sinon undefined
export function offDay(date: string): string | undefined {
  const vac = HOLIDAYS_ZONE_C.find((x) => date >= x.from && date <= x.to);
  if (vac) return `vacances scolaires (${vac.name})`;
  const fer = publicHolidays(Number(date.slice(0, 4))).get(date);
  return fer ? `jour férié (${fer})` : undefined;
}
