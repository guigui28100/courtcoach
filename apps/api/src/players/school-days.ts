// Jours de cours habituels d'un joueur et vacances scolaires de la zone C (Paris).
// Dates à vérifier chaque année sur education.gouv.fr (début = premier jour sans classe, fin = dernier jour sans classe).
export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]; // même ordre que Date.getDay()
export const HOLIDAYS_ZONE_C: { name: string; from: string; to: string }[] = [
  { name: "Toussaint", from: "2025-10-18", to: "2025-11-02" },
  { name: "Noël", from: "2025-12-20", to: "2026-01-04" },
  { name: "hiver", from: "2026-02-21", to: "2026-03-08" },
  { name: "printemps", from: "2026-04-18", to: "2026-05-03" },
  { name: "été", from: "2026-07-04", to: "2026-09-01" },
  { name: "Toussaint", from: "2026-10-17", to: "2026-11-01" },
  { name: "Noël", from: "2026-12-19", to: "2027-01-03" },
  { name: "hiver", from: "2027-02-06", to: "2027-02-21" },
  { name: "printemps", from: "2027-04-03", to: "2027-04-18" },
  { name: "été", from: "2027-07-03", to: "2027-09-01" },
];
// Renvoie une phrase si le jour choisi n'est pas un jour de cours habituel ou tombe pendant les vacances, sinon null
export function offDayReason(day: string, courseDays?: string | null): string | null {
  const h = HOLIDAYS_ZONE_C.find((x) => day >= x.from && day <= x.to);
  if (h) return `Ce jour tombe pendant les vacances scolaires (${h.name}, zone C) : il n'y a normalement pas de cours.`;
  const days = (courseDays ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (days.length) {
    const name = WEEKDAYS[new Date(day + "T12:00:00").getDay()];
    if (!days.includes(name)) return `Ce n'est pas un jour de cours habituel du joueur (${days.join(", ")}).`;
  }
  return null;
}
