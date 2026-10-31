// Planning du club : types d'événements, courts, moments, catégories d'équipes et conflits (copie de apps/api/src/club/club.constants.ts)
import { HOLIDAYS_ZONE_C } from "./schoolDays";

export type Kind = "TOURNOI" | "ANIMATION" | "EQUIPES" | "BULLE" | "BULLE_MONTAGE" | "BULLE_DEMONTAGE" | "BULLE_MONTAGE_TB" | "BULLE_MONTAGE_QUICK" | "BULLE_DEMONTAGE_TB" | "BULLE_DEMONTAGE_QUICK" | "MAINT_BULLE_TB" | "MAINT_BULLE_QUICK" | "TERRE_BATTUE" | "STAGE_ENFANTS" | "STAGE_ADULTES" | "INSCRIPTIONS" | "FETE" | "FETE_ECOLE" | "JUMELAGE" | "DEBUT_COURS" | "FIN_COURS" | "AG" | "AGE" | "AUTRE";
export interface KindInfo { key: Kind; label: string; color: string; icon: string; group: string; who: boolean; courts?: number[] }
// Les choix proposés dans le menu d'une case du jour (rangés par famille)
export const KINDS: KindInfo[] = [
  { key: "TOURNOI", label: "Tournoi", color: "#D35400", icon: "🏆", group: "Compétition", who: true },
  { key: "EQUIPES", label: "Match par équipes", color: "#2E86C1", icon: "🎾", group: "Compétition", who: false },
  { key: "ANIMATION", label: "Animation", color: "#8E44AD", icon: "🎉", group: "Animations et stages", who: true },
  { key: "STAGE_ENFANTS", label: "Stage enfants", color: "#27AE60", icon: "🧒", group: "Animations et stages", who: true },
  { key: "STAGE_ADULTES", label: "Stage adultes", color: "#A04000", icon: "🧑", group: "Animations et stages", who: true },
  { key: "BULLE_MONTAGE_TB", label: "Montage de la bulle · terre battue", color: "#CA6F1E", icon: "🎈", group: "Terrains", who: false, courts: [1, 2] },
  { key: "BULLE_DEMONTAGE_TB", label: "Démontage de la bulle · terre battue", color: "#873600", icon: "🎈", group: "Terrains", who: false, courts: [1, 2] },
  { key: "BULLE_MONTAGE_QUICK", label: "Montage de la bulle · quick", color: "#D4AC0D", icon: "🎈", group: "Terrains", who: false, courts: [3, 4] },
  { key: "BULLE_DEMONTAGE_QUICK", label: "Démontage de la bulle · quick", color: "#9A7D0A", icon: "🎈", group: "Terrains", who: false, courts: [3, 4] },
  { key: "MAINT_BULLE_TB", label: "Maintenance de la bulle · terre battue", color: "#E67E22", icon: "🛠️", group: "Terrains", who: true, courts: [1, 2] },
  { key: "MAINT_BULLE_QUICK", label: "Maintenance de la bulle · quick", color: "#B7950B", icon: "🛠️", group: "Terrains", who: true, courts: [3, 4] },
  { key: "TERRE_BATTUE", label: "Réfection de la terre battue", color: "#C0392B", icon: "🧱", group: "Terrains", who: false },
  { key: "INSCRIPTIONS", label: "Journée d'inscriptions", color: "#16A085", icon: "📝", group: "Vie du club", who: false },
  { key: "JUMELAGE", label: "Jumelage", color: "#5B2C83", icon: "🤝", group: "Animations et stages", who: true },
  { key: "FETE", label: "Fête du club", color: "#E84393", icon: "🥳", group: "Vie du club", who: true },
  { key: "FETE_ECOLE", label: "Fête de l'école de tennis", color: "#00ACC1", icon: "🎊", group: "Vie du club", who: true },
  { key: "DEBUT_COURS", label: "Début des cours", color: "#2C3E50", icon: "🚀", group: "Vie du club", who: false },
  { key: "FIN_COURS", label: "Fin des cours", color: "#7F8C8D", icon: "🏁", group: "Vie du club", who: false },
  { key: "AG", label: "Assemblée générale", color: "#1F618D", icon: "🏛️", group: "Vie du club", who: true },
  { key: "AGE", label: "Assemblée générale extraordinaire", color: "#922B21", icon: "⚖️", group: "Vie du club", who: true },
  { key: "AUTRE", label: "Autre événement", color: "#566573", icon: "📌", group: "Vie du club", who: true },
];
// Anciens types « Bulle », « Montage / Démontage de la bulle » (encore lisibles, plus proposés)
const LEGACY: KindInfo[] = [
  { key: "BULLE", label: "Bulle", color: "#F1C40F", icon: "🎈", group: "Terrains", who: false },
  { key: "BULLE_MONTAGE", label: "Montage de la bulle", color: "#D4AC0D", icon: "🎈", group: "Terrains", who: false },
  { key: "BULLE_DEMONTAGE", label: "Démontage de la bulle", color: "#B7950B", icon: "🎈", group: "Terrains", who: false },
];
export const kindOf = (k: string) => KINDS.find((x) => x.key === k) ?? LEGACY.find((x) => x.key === k) ?? KINDS[0];
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

// Une formule de l'affiche : « Adhérent » → « 60 € »
export interface Formula { label: string; price: string; priceMember?: string; detail?: string; group?: string }
export interface ClubEvent { id: string; position?: number; kind: Kind; title: string; startDate: string; endDate: string; bands: string[]; courts: number[]; teams: string[]; who: string[]; note: string; featured?: boolean; tentative?: boolean; time?: string; place?: string; signup?: string; formulas?: Formula[]; audience?: string; bring?: string }
export interface Draft { id?: string; kind: Kind; title: string; startDate: string; endDate: string; bands: string[]; courts: number[]; teams: string[]; who: string[]; note: string; featured?: boolean; tentative?: boolean; time?: string; place?: string; signup?: string; formulas?: Formula[]; audience?: string; bring?: string }
export interface Clash { id: string; title: string; kind: string; why: string }

// Couleur d'un événement : celle de sa catégorie si c'est un match par équipes (la première), sinon celle de son type
export const TENTATIVE_COLOR = "#b9b3a6"; // gris : événement prévisionnel, pas encore validé
export const colorOf = (e: { kind: string; teams: string[]; tentative?: boolean }) => e.tentative ? TENTATIVE_COLOR : (e.kind === "EQUIPES" && e.teams[0] ? teamCat(e.teams[0])?.color ?? kindOf(e.kind).color : kindOf(e.kind).color);
// Match par équipes : le « club rencontré » est gardé dans la colonne `audience` (aucun changement du serveur)
export const opponentOf = (e: { kind: string; audience?: string }) => (e.kind === "EQUIPES" ? (e.audience ?? "").trim() : "");
// Match par équipes : à domicile ou en déplacement, gardé dans la colonne `place` (aucun changement du serveur)
export const VENUE_HOME = "À domicile";
export const VENUE_AWAY = "En déplacement";
export const venueOf = (e: { kind: string; place?: string }): "home" | "away" | "" => (e.kind !== "EQUIPES" ? "" : e.place === VENUE_HOME ? "home" : e.place === VENUE_AWAY ? "away" : "");
export const venueTag = (e: { kind: string; place?: string }) => (venueOf(e) === "home" ? "🏠 à domicile" : venueOf(e) === "away" ? "🚌 en déplacement" : "");
export function titleOf(e: { kind: string; title: string; teams: string[]; audience?: string; place?: string }) {
  const tag = venueTag(e);
  const sfx = tag ? ` · ${tag}` : "";
  if (e.title) return e.title + (e.kind === "EQUIPES" && !e.title.includes(tag) ? sfx : "");
  if (e.kind === "EQUIPES") return e.teams.map(teamLabel).join(" + ") + (opponentOf(e) ? `${e.teams.length ? " · " : ""}contre ${opponentOf(e)}` : "") + sfx;
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
    if (ev.kind.startsWith("BULLE_") || o.kind.startsWith("BULLE_")) continue;
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

// Un tournoi créé « en cartes » garde son type et ses classements dans son nom : « TMC messieurs de 15/1 à 4/6 », « Tournoi open dames »
export function tourInfo(e: { kind: string; title: string }): { type: "TMC" | "OPEN"; who: string; bas: string; haut: string } | null {
  if (e.kind !== "TOURNOI") return null;
  const m = /^(TMC|Tournoi open)\s*(.*?)(?:\s+de\s+(\S+)\s+à\s+(\S+))?\s*$/i.exec((e.title ?? "").trim());
  if (!m) return null;
  const type = m[1].toUpperCase() === "TMC" ? "TMC" : "OPEN";
  return { type, who: m[2].trim(), bas: type === "TMC" ? m[3] ?? "" : "", haut: type === "TMC" ? m[4] ?? "" : "" };
}
