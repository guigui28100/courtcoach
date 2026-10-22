// Export du planning du club : tableau (Excel), agenda (.ics) et liste imprimable. Tout est fabriqué dans le navigateur, rien n'est envoyé sur Internet.
import { addDays, BANDS, ClubEvent, fmtRange, kindOf, MONTHS, titleOf } from "./clubPlan";
import { teamLabel } from "./clubPlan";

export interface ExportOpts { from: string; to: string; withWho: boolean }

// Événements qui touchent la période, triés par date
export const inPeriod = (events: ClubEvent[], from: string, to: string) =>
  events.filter((e) => e.endDate >= from && e.startDate <= to).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const nameOf = (e: ClubEvent) => (e.kind === "EQUIPES" && !e.title && !e.teams.length ? `Match par équipes${e.audience ? ` · contre ${e.audience}` : ""}` : titleOf(e));
const bandsOf = (e: ClubEvent) => e.bands.map((b) => BANDS.find((x) => x.key === b)?.label ?? b).join(", ");
const formulasOf = (e: ClubEvent) => (e.formulas ?? []).filter((f) => f.label || f.price || f.priceMember).map((f) => `${f.label}${f.priceMember ? ` adhérent ${f.priceMember}` : ""}${f.price ? ` ${f.priceMember ? "non adhérent " : ""}${f.price}` : ""}`).join(" / ");

// Tableau lisible par Excel : séparateur « ; », accents conservés (BOM), une ligne par événement
export function toCsv(events: ClubEvent[], o: ExportOpts) {
  const head = ["Début", "Fin", "Type", "Titre", "Horaires", "Moment", "Terrains", "Lieu", "Pour qui", "Tarifs", "Inscriptions", "Description", "Mis en avant", ...(o.withWho ? ["Qui s'en occupe"] : [])];
  const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const rows = inPeriod(events, o.from, o.to).map((e) => [dmy(e.startDate), dmy(e.endDate), kindOf(e.kind).label, nameOf(e), e.time ?? "", bandsOf(e), e.courts.length ? e.courts.map((c) => `Court ${c}`).join(", ") : "", e.place ?? "", e.audience ?? "", formulasOf(e), e.signup ?? "", e.note ?? "", e.featured ? "oui" : "", ...(o.withWho ? [e.who.join(", ")] : [])]);
  return "\ufeff" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

// Agenda (.ics) : s'importe dans Google Agenda, Outlook, Apple Agenda… ; chaque événement est une journée entière (ou plusieurs)
const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => { const out: string[] = []; let s = line; while (s.length > 70) { out.push(s.slice(0, 70)); s = " " + s.slice(70); } out.push(s); return out.join("\r\n"); };
export function toIcs(events: ClubEvent[], o: ExportOpts) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tennis Club Houdan//CourtCoach//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Planning du Tennis Club Houdan"];
  for (const e of inPeriod(events, o.from, o.to)) {
    const k = kindOf(e.kind);
    const desc = [k.label, e.time && `Horaires : ${e.time}`, e.audience && `Pour qui : ${e.audience}`, formulasOf(e) && `Tarifs : ${formulasOf(e)}`, e.signup && `Inscriptions : ${e.signup}`, e.note, o.withWho && e.who.length ? `Avec : ${e.who.join(", ")}` : ""].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${e.id}@courtcoach`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.startDate.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(e.endDate, 1).replace(/-/g, "")}`, `SUMMARY:${esc(`${k.icon} ${nameOf(e)}`)}`, ...(e.place ? [`LOCATION:${esc(e.place)}`] : []), `DESCRIPTION:${esc(desc)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Regroupe par mois pour la liste imprimable
export function byMonth(events: ClubEvent[], from: string, to: string) {
  const list = inPeriod(events, from, to); const out: { label: string; items: ClubEvent[] }[] = [];
  for (const e of list) { const m = e.startDate < from ? from.slice(0, 7) : e.startDate.slice(0, 7); const label = `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`; let g = out.find((x) => x.label === label); if (!g) { g = { label, items: [] }; out.push(g); } g.items.push(e); }
  return out;
}
export const rangeText = (e: ClubEvent) => fmtRange(e.startDate, e.endDate);
