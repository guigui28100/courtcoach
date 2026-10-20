// Planning du club : types d'événements, courts, moments, catégories d'équipes et conflits (copie de apps/api/src/club/club.constants.ts)
import { HOLIDAYS_ZONE_C } from "./schoolDays";

export type Kind = "TOURNOI" | "ANIMATION" | "EQUIPES" | "BULLE" | "TERRE_BATTUE" | "STAGE_ENFANTS" | "STAGE_ADULTES" | "INSCRIPTIONS" | "FETE" | "DEBUT_COURS" | "FIN_COURS";
export const KINDS: { key: Kind; label: string; color: string }[] = [
  { key: "TOURNOI", label: "Tournoi", color: "#D35400" },
  { key: "ANIMATION", label: "Animation", color: "#8E44AD" },
  { key: "EQUIPES", label: "Match par équipes", color: "#2E86C1" },
  { key: "BULLE", label: "Bulle : montage / démontage", color: "#F1C40F" },
  { key: "TERRE_BATTUE", label: "Terre battue : réfection", color: "#C0392B" },
  { key: "STAGE_ENFANTS", label: "Stage enfants", color: "#27AE60" },
  { key: "STAGE_ADULTES", label: "Stage adultes", color: "#A04000" },
  { key: "INSCRIPTIONS", label: "Journée d'inscriptions", color: "#16A085" },
  { key: "FETE", label: "Fête du club", color: "#E84393" },
  { key: "DEBUT_COURS", label: "Début des cours", color: "#2C3E50" },
  { key: "FIN_COURS", label: "Fin des cours", color: "#7F8C8D" },
];
export const kindOf = (k: string) => KINDS.find((x) => x.key === k) ?? KINDS[0];
export const BANDS: { key: string; label: string; hours: string }[] = [
  { key: "MATIN", label: "Matin", hours: "8 h – 13 h" },
  { key: "APRES_MIDI", label: "Après-midi", hours: "13 h – 18 h" },
  { key: "SOIR", label: "Soir", hours: "18 h – 23 h" },
];
export const COURTS: { n: number; label: string; surface: string }[] = [
  { n: 1, label: "Court 1", surface: "terre battue couverte" },
  { n: 2, label: "Court 2", surface: "terre battue couverte" },
  { n: 3, label: "Court 3", surface: "dur couvert" },
  { n: 4, label: "Court 4", surface: "dur couvert" },
];
export const CLAY_COURTS = [1, 2];
export const MAX_TEAMS = 6;
// Catégories d'équipes (bleu = messieurs et garçons, rose et violet = dames et filles, orange et vert = balles des 8/10 ans)
export const TEAM_CATS: { key: string; group: string; label: string; color: string; def: number }[] = [
  { key: "gar-8-10-orange", group: "Jeunes · garçons", label: "8/10 ans orange · garçons", color: "#F5A623", def: 2 },
  { key: "gar-8-10-vert", group: "Jeunes · garçons", label: "8/10 ans vert · garçons", color: "#A3D977", def: 2 },
  { key: "gar-11-12", group: "Jeunes · garçons", label: "11/12 ans garçons", color: "#85C1E9", def: 2 },
  { key: "gar-13-14", group: "Jeunes · garçons", label: "13/14 ans garçons", color: "#5DADE2", def: 2 },
  { key: "gar-15-18", group: "Jeunes · garçons", label: "15/18 ans garçons", color: "#2E86C1", def: 2 },
  { key: "fil-8-10-orange", group: "Jeunes · filles", label: "8/10 ans orange · filles", color: "#FAC775", def: 2 },
  { key: "fil-8-10-vert", group: "Jeunes · filles", label: "8/10 ans vert · filles", color: "#C9E8A5", def: 2 },
  { key: "fil-11-12", group: "Jeunes · filles", label: "11/12 ans filles", color: "#F5B7D5", def: 2 },
  { key: "fil-13-14", group: "Jeunes · filles", label: "13/14 ans filles", color: "#EC7FB5", def: 2 },
  { key: "fil-15-18", group: "Jeunes · filles", label: "15/18 ans filles", color: "#D6458F", def: 2 },
  { key: "sen-m", group: "Seniors", label: "Seniors messieurs", color: "#1B4F72", def: 3 },
  { key: "sen-d", group: "Seniors", label: "Seniors dames", color: "#A5276A", def: 3 },
  { key: "vet-35-m", group: "Vétérans", label: "+35 ans messieurs", color: "#117A65", def: 2 },
  { key: "vet-45-m", group: "Vétérans", label: "+45 ans messieurs", color: "#0B5345", def: 2 },
  { key: "vet-35-d", group: "Vétérans", label: "+35 ans dames", color: "#884EA0", def: 2 },
  { key: "vet-45-d", group: "Vétérans", label: "+45 ans dames", color: "#5B2C6F", def: 2 },
];
export const teamCat = (key: string) => TEAM_CATS.find((c) => c.key === key.split("#")[0]);
export const teamLabel = (t: string) => { const c = teamCat(t); return c ? `${c.label} · Éq. ${t.split("#")[1]}` : t; };
const LIGHT = new Set(["#F5A623", "#A3D977", "#FAC775", "#C9E8A5", "#85C1E9", "#F5B7D5", "#F1C40F"]);
export const textOn = (bg: string) => (LIGHT.has(bg) ? "#10203a" : "#ffffff");

export interface ClubEvent { id: string; kind: Kind; title: string; startDate: string; endDate: string; bands: string[]; courts: number[]; teams: string[]; who: string[]; note: string }
export interface Draft { id?: string; kind: Kind; title: string; startDate: string; endDate: string; bands: string[]; courts: number[]; teams: string[]; who: string[]; note: string }
export interface Clash { id: string; title: string; kind: string; why: string }

// Couleur d'un événement : celle de sa catégorie si c'est un match par équipes (la première), sinon celle de son type
export const colorOf = (e: { kind: string; teams: string[] }) => (e.kind === "EQUIPES" && e.teams[0] ? teamCat(e.teams[0])?.color ?? kindOf(e.kind).color : kindOf(e.kind).color);
export function titleOf(e: { kind: string; title: string; teams: string[] }) {
  if (e.title) return e.title;
  if (e.kind === "EQUIPES") return e.teams.map(teamLabel).join(" + ");
  return kindOf(e.kind).label;
}
// Nom proposé automatiquement quand le coach n'en écrit pas
export const proposedTitle = (d: { kind: string; teams: string[] }) => titleOf({ kind: d.kind, title: "", teams: d.teams });

const overlap = (a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) => a.startDate <= b.endDate && b.startDate <= a.endDate;
const meet = (a: string[], b: string[]) => a.length === 0 || b.length === 0 || a.some((x) => b.includes(x));
export function clashesWith(ev: Draft, others: ClubEvent[]): Clash[] {
  const out: Clash[] = [];
  for (const o of others) {
    if (ev.id && o.id === ev.id) continue;
    if (!overlap(ev, o)) continue;
    const shared = ev.courts.filter((c) => o.courts.includes(c));
    const label = titleOf(o);
    if (ev.kind === "BULLE" && o.kind === "BULLE" && shared.length) { out.push({ id: o.id, title: label, kind: o.kind, why: `une autre bulle est déjà prévue sur le court ${shared[0]}` }); continue; }
    const refec = (ev.kind === "TERRE_BATTUE" && o.kind === "BULLE") || (ev.kind === "BULLE" && o.kind === "TERRE_BATTUE");
    if (refec && shared.length) { out.push({ id: o.id, title: label, kind: o.kind, why: "la bulle est montée pendant la réfection de la terre battue" }); continue; }
    if (ev.kind === "BULLE" || o.kind === "BULLE") continue;
    if (shared.length && meet(ev.bands, o.bands)) { out.push({ id: o.id, title: label, kind: o.kind, why: `le court ${shared[0]} est déjà pris à ce moment-là` }); continue; }
    if (ev.teams.some((t) => o.teams.includes(t)) && meet(ev.bands, o.bands)) out.push({ id: o.id, title: label, kind: o.kind, why: "cette équipe joue déjà à ce moment-là" });
  }
  return out;
}
// Tous les conflits déjà présents dans le planning (deux à deux)
export function allClashes(events: ClubEvent[]) {
  const seen = new Set<string>(); const out: { a: ClubEvent; b: ClubEvent; why: string }[] = [];
  for (const a of events) for (const c of clashesWith(a, events)) { const b = events.find((x) => x.id === c.id)!; const k = [a.id, b.id].sort().join("|"); if (!seen.has(k)) { seen.add(k); out.push({ a, b, why: c.why }); } }
  return out;
}

// ----- Dates (toujours AAAA-MM-JJ, en UTC pour éviter les décalages d'heure) -----
export const addDays = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
export const weekdayOf = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
export const mondayOf = (d: string) => addDays(d, -weekdayOf(d));
export const todayParis = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
export const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const fmtDay = (d: string) => `${DAYS[weekdayOf(d)].toLowerCase()} ${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1].toLowerCase()}`;
export const fmtRange = (a: string, b: string) => (a === b ? fmtDay(a) : `du ${fmtDay(a)} au ${fmtDay(b)}`);
// Saison sportive : de septembre à août ; première semaine = celle du 1er septembre
export const seasonOf = (d: string) => (+d.slice(5, 7) >= 9 ? +d.slice(0, 4) : +d.slice(0, 4) - 1);
export const seasonStart = (y: number) => mondayOf(`${y}-09-01`);
export const seasonWeeks = (y: number) => { const s = seasonStart(y); const end = `${y + 1}-08-31`; let n = 0; while (addDays(s, 7 * n) <= end) n++; return n; };
export const isVacation = (d: string) => HOLIDAYS_ZONE_C.some((h) => d >= h.from && d <= h.to);
export const vacationWeeks = (y: number) => { const s = seasonStart(y); const n = seasonWeeks(y); const out: boolean[] = []; for (let i = 0; i < n; i++) { const mon = addDays(s, 7 * i); out.push(HOLIDAYS_ZONE_C.some((h) => mon <= h.to && addDays(mon, 6) >= h.from)); } return out; };
// Une suite de courts consécutifs (ex. [1,2,4] → [[1,2],[4]]) : une barre par suite sur la frise
export function courtRuns(courts: number[]) { const s = [...courts].sort(); const out: number[][] = []; for (const c of s) { const l = out[out.length - 1]; if (l && l[l.length - 1] === c - 1) l.push(c); else out.push([c]); } return out; }
