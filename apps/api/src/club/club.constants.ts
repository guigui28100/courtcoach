// Planning du club : types d'événements, moments de la journée, courts et catégories d'équipes (copie côté site : apps/web/src/clubPlan.ts)
export const KINDS = ["TOURNOI", "ANIMATION", "EQUIPES", "BULLE", "BULLE_MONTAGE", "BULLE_DEMONTAGE", "TERRE_BATTUE", "STAGE_ENFANTS", "STAGE_ADULTES", "INSCRIPTIONS", "FETE", "DEBUT_COURS", "FIN_COURS"] as const;
export type Kind = (typeof KINDS)[number];
export const BANDS = ["MATIN", "APRES_MIDI", "SOIR"] as const;
export const COURTS = [1, 2, 3, 4]; // 1 et 2 : terre battue couverte ; 3 et 4 : dur couvert
export const CLAY_COURTS = [1, 2];
// Catégories d'équipes : [clé, nombre d'équipes par défaut]
export const TEAM_CATS: [string, number][] = [
  ["gar-8-10-orange", 2], ["gar-8-10-vert", 2], ["gar-11-12", 2], ["gar-13-14", 2], ["gar-15-18", 2],
  ["fil-8-10-orange", 2], ["fil-8-10-vert", 2], ["fil-11-12", 2], ["fil-13-14", 2], ["fil-15-18", 2],
  ["sen-m", 3], ["sen-d", 3],
  ["vet-35-m", 2], ["vet-45-m", 2], ["vet-35-d", 2], ["vet-45-d", 2],
];
export const MAX_TEAMS = 6;
export const PEOPLE_ROLES = ["BENEVOLE", "BUREAU", "PROF"] as const; // bénévole, membre du bureau, professeur ou entraîneur sans compte
export const MAX_PEOPLE = 100;

export interface PlanEvent { id?: string; kind: string; startDate: string; endDate: string; bands: string[]; courts: number[]; teams: string[]; title?: string }
export interface Clash { id: string; title: string; kind: string; why: string }

const overlapDates = (a: PlanEvent, b: PlanEvent) => a.startDate <= b.endDate && b.startDate <= a.endDate;
const bandsMeet = (a: string[], b: string[]) => a.length === 0 || b.length === 0 || a.some((x) => b.includes(x));

// Conflits d'un événement avec les autres : même court + mêmes jours + même moment ; la bulle est un décor (elle ne gêne pas les autres événements), mais deux bulles sur le même court, ou une réfection de terre battue pendant que la bulle est montée, sont refusées ; une même équipe ne joue pas deux fois en même temps
export function clashesWith(ev: PlanEvent, others: (PlanEvent & { id: string })[]): Clash[] {
  const out: Clash[] = [];
  for (const o of others) {
    if (ev.id && o.id === ev.id) continue;
    if (!overlapDates(ev, o)) continue;
    // Le montage et le démontage de la bulle sont de simples repères : ils ne gênent aucun autre événement
    if (["BULLE_MONTAGE", "BULLE_DEMONTAGE"].includes(ev.kind) || ["BULLE_MONTAGE", "BULLE_DEMONTAGE"].includes(o.kind)) continue;
    const sharedCourts = ev.courts.filter((c) => o.courts.includes(c));
    const label = o.title || o.kind;
    if (ev.kind === "BULLE" && o.kind === "BULLE" && sharedCourts.length) { out.push({ id: o.id, title: label, kind: o.kind, why: `une autre bulle est déjà prévue sur le court ${sharedCourts[0]}` }); continue; }
    const refec = (ev.kind === "TERRE_BATTUE" && o.kind === "BULLE") || (ev.kind === "BULLE" && o.kind === "TERRE_BATTUE");
    if (refec && sharedCourts.length) { out.push({ id: o.id, title: label, kind: o.kind, why: "la bulle est montée pendant la réfection de la terre battue" }); continue; }
    if (ev.kind === "BULLE" || o.kind === "BULLE") continue;
    if (sharedCourts.length && bandsMeet(ev.bands, o.bands)) { out.push({ id: o.id, title: label, kind: o.kind, why: `le court ${sharedCourts[0]} est déjà pris à ce moment-là` }); continue; }
    const sameTeam = ev.teams.find((t) => o.teams.includes(t));
    if (sameTeam && bandsMeet(ev.bands, o.bands)) out.push({ id: o.id, title: label, kind: o.kind, why: "cette équipe joue déjà à ce moment-là" });
  }
  return out;
}
