import { Backdrop } from "./PosterBackdrop";
import { SERIF } from "./posterFonts";
import { glue, teamParts } from "./posterCopy";
import { useLayoutEffect, useRef, useState } from "react";
import { NoBreak } from "./NoBreak";
import { Fmts, FmtStyle, pickFmt, stepZoom } from "./posterFmt";
import { CourtLines } from "./CourtLines";
import { addDays, ClubEvent, colorOf, DAYS, kindOf, mondayOf, MONTHS, opponentOf, seasonOf, teamCat, teamLabel, textOn, titleOf, venueTag, weekdayOf } from "../clubPlan";

// Affiche du mois (format A4 : 794 × 1123 px, tout est dessiné ici : aucune image ni police extérieure)
export const POSTER_W = 794;
export const POSTER_H = 1123;
export type PosterModel = "liste" | "calendrier";


const SHORT = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const PRIORITY = ["FETE", "FETE_ECOLE", "JUMELAGE", "TOURNOI", "STAGE_ENFANTS", "STAGE_ADULTES", "ANIMATION", "EQUIPES", "INSCRIPTIONS", "DEBUT_COURS", "FIN_COURS", "AG", "AGE"];

const monthEnd = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);

const monthDays = (m: string) => { const gs = mondayOf(`${m}-01`); const n = Math.ceil((weekdayOf(`${m}-01`) + +monthEnd(m).slice(8, 10)) / 7) * 7; return Array.from({ length: n }, (_, i) => addDays(gs, i)); };

export function monthEvents(events: ClubEvent[], m: string) {
  const a = `${m}-01`; const b = monthEnd(m);
  return events.filter((e) => e.startDate <= b && e.endDate >= a).sort((x, y) => x.startDate.localeCompare(y.startDate) || x.kind.localeCompare(y.kind));
}

// Les équipes d'un match, regroupées par catégorie : « Seniors messieurs (Éq. 1, 2) »
function teamsText(e: ClubEvent) {
  const by = new Map<string, number[]>();
  for (const t of e.teams) { const [c, n] = t.split("#"); by.set(c, [...(by.get(c) ?? []), +n]); }
  return [...by.entries()].map(([c, ns]) => `${teamCat(c)?.label ?? c} (Éq. ${ns.join(", ")})`).join(" · ");
}
const BAND_TXT: Record<string, string> = { MATIN: "matin", APRES_MIDI: "après-midi", SOIR: "soirée" };
function detailParts(e: ClubEvent, showWho: boolean) {
  const parts: string[] = [];
  if (e.kind === "EQUIPES") { if (e.time) parts.push(`🕒 ${e.time}`); if (e.courts.length) parts.push(`🏟️ ${e.courts.length === 1 ? "Court" : "Courts"} ${e.courts.length > 1 ? e.courts.slice(0, -1).join(", ") + " et " + e.courts[e.courts.length - 1] : e.courts[0]}`); }
  if (e.kind === "EQUIPES" && e.teams.length && e.title) parts.push(teamsText(e)); // sans nom écrit à la main, catégorie et numéro sont déjà dans le titre
  if (e.bands.length) parts.push(e.bands.map((b) => BAND_TXT[b]).join(" + "));
  if (showWho && e.who.length) parts.push(`avec ${e.who.map((w) => w.replace(" (moi)", "")).join(", ")}`);
  return parts;
}
const detail = (e: ClubEvent, showWho: boolean) => detailParts(e, showWho).join(" · ");
// Match par équipes sans nom écrit à la main : « Match · Seniors messieurs · Éq. 1 · contre TC Dreux · 🏠 à domicile »
export const label = (e: ClubEvent) => (e.kind === "EQUIPES" && !e.title ? (e.teams.length ? `Match · ${titleOf(e)}` : `Match par équipes${opponentOf(e) ? ` · contre ${opponentOf(e)}` : ""}${venueTag(e) ? ` · ${venueTag(e)}` : ""}`) : titleOf(e));
// Un match s'écrit en morceaux qui ne se coupent jamais : « Match · Seniors messieurs · Éq. 1 », « contre TC Dreux », « 🏠 à domicile »
const labelParts = (e: ClubEvent): string[] => (e.kind !== "EQUIPES" || e.title || !e.teams.length ? [label(e)] : ["Match", e.teams.map(teamLabel).join(" + "), opponentOf(e) ? `contre ${opponentOf(e)}` : "", venueTag(e)].filter(Boolean));
const isMatch = (e: ClubEvent) => labelParts(e)[0] === "Match" && labelParts(e).length > 1;
// Affiche les morceaux séparés par « · » ; le retour à la ligne ne peut se faire qu'entre deux morceaux
function Parts({ parts, icon }: { parts: string[]; icon?: string }) {
  return <>{parts.map((t, i) => <span key={i}>{i > 0 ? <span aria-hidden> · </span> : null}<span style={{ whiteSpace: "nowrap" }}>{i === 0 && icon ? `${icon}\u00a0` : ""}{t}</span></span>)}</>;
}
// Match par équipes : la catégorie sur UNE ligne (« Vétérans +45 ans dames »), le numéro dessous (« Équipe 1 »), puis le club et le lieu
function MatchLines({ e, icon, rest, inline }: { e: ClubEvent; icon?: string; rest?: boolean; inline?: boolean }) {
  const more = labelParts(e).slice(2);
  return <>{e.teams.map((t, i) => { const [cat, num] = teamParts(t); return inline ? (
    <span key={t} style={{ display: "block", marginTop: i ? 3 : 0 }}><span style={{ whiteSpace: "nowrap" }}>{i === 0 && icon ? `${icon}\u00a0` : ""}{cat}</span>{" "}<span style={{ whiteSpace: "nowrap", fontWeight: 900, color: "#b8471f" }}>· {num}</span></span>
  ) : (
    <span key={t} style={{ display: "block", marginTop: i ? 3 : 0 }}>
      <span data-nw style={{ display: "block", whiteSpace: "nowrap" }}>{i === 0 && icon ? `${icon}\u00a0` : ""}{cat}</span>
      <span style={{ display: "block", fontWeight: 900, color: "#b8471f", fontSize: "1.05em", lineHeight: 1.15 }}>{num}</span>
    </span>); })}{rest !== false && more.length > 0 ? <span style={{ display: "block", fontWeight: 700, fontSize: "0.9em", marginTop: 2 }}><Parts parts={more} /></span> : null}</>;
}
const dayNum = (d: string) => +d.slice(8, 10);
// Date complète : « Samedi 14 novembre » ou « Samedi 14 → dimanche 15 novembre »
export const fullRange = (e: ClubEvent) => {
  const d = (x: string, month: boolean) => `${DAYS[weekdayOf(x)]} ${dayNum(x)}${month ? " " + MONTHS[+x.slice(5, 7) - 1].toLowerCase() : ""}`;
  if (e.startDate === e.endDate) return d(e.startDate, true);
  const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
  return `Du ${d(e.startDate, !same).replace(/^./, (c) => c.toLowerCase())} au ${d(e.endDate, true).replace(/^./, (c) => c.toLowerCase())}`;
};
const rangeText = (e: ClubEvent) => {
  if (e.startDate === e.endDate) return `${DAYS[weekdayOf(e.startDate)]} ${dayNum(e.startDate)}`;
  const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
  return `${DAYS[weekdayOf(e.startDate)].slice(0, 3)}. ${dayNum(e.startDate)}${same ? "" : " " + MONTHS[+e.startDate.slice(5, 7) - 1].toLowerCase()} → ${DAYS[weekdayOf(e.endDate)].slice(0, 3)}. ${dayNum(e.endDate)}`;
};

// Logo du club (blanc sur transparent) : même fichier que sur le site
const PosterLogo = ({ size, color = "#fff", style }: { size: number; color?: string; style?: React.CSSProperties }) => (
  <span aria-hidden style={{ display: "inline-block", width: size, height: size, background: color, WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", ...style }} />
);

function Header({ m, z = 1 }: { m: string; z?: number }) {
  const year = +m.slice(0, 4); const s = seasonOf(`${m}-01`);
  return (
    <div style={{ position: "relative", height: 290, background: "linear-gradient(135deg,#2b261d 0%,#17140f 60%)", color: "#fff", overflow: "hidden", fontVariantNumeric: "lining-nums", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)" }}>
      <svg aria-hidden="true" width="794" height="290" viewBox="0 0 794 290" style={{ position: "absolute", inset: 0, opacity: 0.22 }} fill="none" stroke="#c9ad77" strokeWidth="4">
        <CourtLines cx={397} y={24} h={228} netWidth={6} />
      </svg>
      <PosterLogo size={150} style={{ position: "absolute", right: 30, top: 24, filter: "drop-shadow(0 6px 8px rgba(0,0,0,.3))" }} />
      <div style={{ position: "absolute", left: 52, top: 40, zoom: z }}><div data-fmt="entete">
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.32em", opacity: 0.95 }}>TENNIS CLUB HOUDAN</div>
        <div style={{ fontFamily: SERIF, fontSize: MONTHS[+m.slice(5, 7) - 1].length > 7 ? 68 : 84, fontWeight: 900, lineHeight: 1, letterSpacing: "0.02em", marginTop: 8, textShadow: "0 4px 0 rgba(0,0,0,.18)" }}>{MONTHS[+m.slice(5, 7) - 1].toUpperCase()}</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <span style={{ background: "#c9ad77", color: "#17140f", fontWeight: 900, fontSize: 24, borderRadius: 999, padding: "2px 18px" }}>{year}</span>
          <span style={{ fontWeight: 700, fontSize: 19, opacity: 0.95 }}>Saison {s} – {s + 1}</span>
        </div>
      </div></div>
    </div>
  );
}

function Footer({ events }: { events: ClubEvent[] }) {
  const kinds = [...new Set(events.map((e) => e.kind))].map(kindOf);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: "#17140f", color: "#fff", padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
      <div data-fmt="pied" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "0.04em" }}><PosterLogo size={26} style={{ verticalAlign: "-6px", marginRight: 8 }} />Tennis Club Houdan</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>4 courts couverts · terre battue et dur · septembre → mai</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 3, color: "#dfcb98", whiteSpace: "nowrap" }}>✉️ tennisclubhoudan@gmail.com</div>
      </div>
      <div data-fmt="legende" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "flex-end", maxWidth: 330, fontSize: 11.5 }}>
        {kinds.map((k) => <span key={k.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 11, height: 11, borderRadius: 3, background: k.color, display: "inline-block" }} />{k.label}</span>)}
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ margin: "40px 52px", textAlign: "center", fontSize: 24, color: "#6b6557", fontWeight: 700 }}>🎾 Le programme de ce mois arrive bientôt…</div>;
}

// Le coach choisit avec la case « ⭐ à mettre en avant » (3 au maximum, dans l'ordre des dates) ; sans aucune étoile, choix automatique d'après le type
function pickTop(list: ClubEvent[]): ClubEvent[] {
  const starred = list.filter((e) => e.featured).slice(0, 3);
  const auto = [...list].filter((e) => PRIORITY.includes(e.kind) && !["INSCRIPTIONS", "DEBUT_COURS", "FIN_COURS"].includes(e.kind)).sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind)).slice(0, 3).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return list.some((e) => e.featured) ? starred : auto;
}
function Featured({ list, showWho }: { list: ClubEvent[]; showWho: boolean }) {
  const top = pickTop(list);
  if (top.length === 0) return null;
  const MOIS = MONTHS.map((x) => x.toLowerCase());
  const lc = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  return (
    <div style={{ padding: "0 40px", textAlign: "left" }}>
      <div data-fmt="titres" style={{ fontFamily: SERIF, fontWeight: 900, color: "#fff", background: "#7b5d2a", letterSpacing: "0.1em", fontSize: 22, marginBottom: 10, display: "inline-block", padding: "5px 18px", borderRadius: 999 }}>★ À NE PAS MANQUER</div>
      <div style={{ display: "grid", gap: 10 }}>
        {top.map((e) => { const k = kindOf(e.kind); const c = colorOf(e); const multi = e.startDate !== e.endDate; const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7); const dayName = { fontSize: 19, fontWeight: 900, lineHeight: 1.15, letterSpacing: "0.07em", textTransform: "uppercase" } as const; return (
          <div key={e.id} data-card style={{ display: "flex", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 14px rgba(27,24,99,.16)", border: `3px solid ${c}` }}>
            {multi ? (
              // Période écrite en phrase : « Du samedi 7 au dimanche 15 novembre », deux jours de même taille, bien alignés
              <div style={{ background: c, color: textOn(c), width: "31%", flex: "0 0 31%", padding: "12px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch", textAlign: "center", lineHeight: 1.1 }}><div data-fmt="cdate">
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.9 }}>Du</div>
                <div style={{ fontFamily: SERIF, fontSize: 31, fontWeight: 900, lineHeight: 1.05, marginTop: 2 }}>{lc(DAYS[weekdayOf(e.startDate)])} {dayNum(e.startDate)}{same ? "" : <span style={{ display: "block", fontFamily: "inherit", fontSize: 14, fontWeight: 800 }}>{MOIS[+e.startDate.slice(5, 7) - 1]}</span>}</div>
                <div aria-hidden style={{ height: 2, background: "currentColor", opacity: 0.45, margin: "8px 22% 6px" }} />
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.9 }}>au</div>
                <div style={{ fontFamily: SERIF, fontSize: 31, fontWeight: 900, lineHeight: 1.05, marginTop: 2 }}>{lc(DAYS[weekdayOf(e.endDate)])} {dayNum(e.endDate)}</div>
                {!same && <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>{MOIS[+e.endDate.slice(5, 7) - 1]}</div>}
              </div></div>
            ) : (
            <div style={{ background: c, color: textOn(c), width: "31%", flex: "0 0 31%", padding: "10px 16px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}><div data-fmt="cdate">
              <div style={dayName}>{DAYS[weekdayOf(e.startDate)]}</div>
              <div style={{ fontFamily: SERIF, fontSize: 54, fontWeight: 900, lineHeight: 1.05 }}>{dayNum(e.startDate)}</div>
            </div></div>
            )}
            <div style={{ padding: "10px 18px", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "left" }}><div data-fmt="ctexte">
              {isMatch(e) ? <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.14em", color: "#6b6557", marginBottom: 2 }}>{k.icon} MATCH PAR ÉQUIPES</div> : null}
              <div style={{ fontWeight: 900, fontSize: 24, color: "#17140f", lineHeight: 1.15 }}>{isMatch(e) ? <MatchLines e={e} rest={false} /> : <>{k.icon} {labelParts(e)[0]}</>}</div>
              {(isMatch(e) ? labelParts(e).slice(2) : labelParts(e).slice(1)).length || detailParts(e, showWho).length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", marginTop: 8 }}>
                  {[...(isMatch(e) ? labelParts(e).slice(2) : labelParts(e).slice(1)), ...detailParts(e, showWho)].map((t, i) => <span key={i} style={{ whiteSpace: "nowrap", background: "#f1ebdd", color: "#17140f", fontWeight: 800, fontSize: 16, borderRadius: 999, padding: "3px 12px" }}>{t}</span>)}
                </div>
              ) : null}
              {e.note && <div style={{ fontSize: 14, color: "#2b261d", marginTop: 5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}><NoBreak text={glue(e.note)} /></div>}
            </div></div>
          </div>
        ); })}
      </div>
    </div>
  );
}

// Date d'un événement sur la frise : « Dimanche 8 novembre » ou, pour une période, deux lignes « Du lundi 23 » / « au mercredi 25 novembre »
const whenLines = (e: ClubEvent, short = false): string[] => {
  const lc = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  const abbr = (x: string) => (x.length <= 4 ? x : x === "juillet" ? "juil." : x === "septembre" ? "sept." : `${x.slice(0, 3)}.`);
  const mo = (x: string) => { const t = MONTHS[+x.slice(5, 7) - 1].toLowerCase(); return short ? abbr(t) : t; };
  const dn = (x: string) => (short ? `${DAYS[weekdayOf(x)].slice(0, 3).toLowerCase()}.` : lc(DAYS[weekdayOf(x)]));
  const d = (x: string, month: boolean) => `${dn(x)} ${dayNum(x)}${month ? " " + mo(x) : ""}`;
  if (e.startDate === e.endDate) return [short ? `${dn(e.startDate).replace(/^./, (c) => c.toUpperCase())} ${dayNum(e.startDate)}` : `${DAYS[weekdayOf(e.startDate)]} ${dayNum(e.startDate)}`]; // le mois est écrit en haut de l'affiche : inutile de le répéter
  const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
  return [`Du ${d(e.startDate, !same)}`, `au ${d(e.endDate, !same)}`]; // le mois est déjà écrit en haut de l'affiche : on ne le répète que si la période change de mois
};

// « Et aussi ce mois-ci » : une frise verticale (la date à gauche, la puce SUR la ligne, l'événement à droite)
function ListModel({ m, list, showWho, withCards }: { m: string; list: ClubEvent[]; showWho: boolean; withCards: boolean }) {
  const n = list.length;
  const cap = 12;
  const shown = list.slice(0, cap); const more = n - shown.length; const two = n > 8;
  const half = two ? Math.ceil(shown.length / 2) : shown.length;
  const cols = two ? [shown.slice(0, half), shown.slice(half)] : [shown];
  const dateW = two ? 96 : 170;
  const LH = "21px";
  const row = (e: ClubEvent) => {
    const k = kindOf(e.kind); const lines = whenLines(e, two);
    const det = e.kind === "EQUIPES" ? detailParts(e, false) : detailParts(e, showWho);
    return (
      <div key={e.id} style={{ display: "grid", gridTemplateColumns: `${dateW}px ${two ? 28 : 34}px 1fr`, padding: "8px 0", alignItems: "start", textAlign: "left" }}>
        <div data-fmt="ldate">{lines.length === 2 ? (
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", justifyContent: "end", columnGap: 8, fontSize: two ? 13 : 15, fontWeight: 800, color: "#17140f", lineHeight: LH }}>
            {lines.map((l, i) => <><span key={`a${i}`} style={{ fontSize: "0.8em", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7b5d2a", textAlign: "left" }}>{i ? "au" : "du"}</span><span key={`b${i}`} style={{ textAlign: "left", whiteSpace: "nowrap" }}>{l.replace(/^(Du|au) /, "")}</span></>)}
          </div>
        ) : <div style={{ textAlign: "right", fontSize: two ? 13 : 15, fontWeight: 800, color: "#17140f", lineHeight: LH, whiteSpace: "nowrap" }}>{lines[0]}</div>}</div>
        <div aria-hidden style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}><span style={{ width: 16, height: 16, borderRadius: 8, background: colorOf(e), boxShadow: "0 0 0 4px #fbf5ea", position: "relative", zIndex: 1 }} /></div>
        <div style={{ minWidth: 0 }}><div data-fmt="ltexte">
          <div style={{ fontSize: two ? 14.5 : 17, fontWeight: 900, color: "#17140f", lineHeight: LH }}>{isMatch(e) ? <MatchLines e={e} icon={k.icon} inline /> : two ? `${k.icon}\u00a0${labelParts(e).join(" · ")}` : <Parts icon={k.icon} parts={labelParts(e)} />}</div>
          {det.length > 0 && <div style={{ fontSize: two ? 12.5 : 14.5, fontWeight: 700, color: "#4a4333", lineHeight: 1.3, marginTop: 1 }}><Parts parts={det} /></div>}
          {e.note && <div style={{ fontSize: two ? 12.5 : 13.5, color: "#3a352c", lineHeight: 1.3, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><NoBreak text={glue(e.note)} /></div>}
        </div></div>
      </div>
    );
  };
  return (
    <div style={{ padding: "0 40px", marginTop: withCards ? 20 : 18, textAlign: "left" }}>
      {n > 0 ? (<>
        <div data-fmt="titres" style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.3em", color: "#7b5d2a", marginBottom: 6 }}>{withCards ? "ET AUSSI CE MOIS-CI" : "TOUT LE PROGRAMME"}</div>
        <div style={{ display: "grid", gridTemplateColumns: two ? "1fr 1fr" : "1fr", columnGap: 24, alignItems: "start" }}>
          {cols.map((c, i) => (
            <div key={i} style={{ position: "relative" }}>
              <div aria-hidden style={{ position: "absolute", left: dateW + (two ? 13 : 15.5), top: 14, bottom: 14, width: 3, background: "#d9c6a3" }} />
              {c.map(row)}
            </div>
          ))}
        </div>
        {more > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6b6557", marginTop: 8 }}>… et {more} autre{more > 1 ? "s" : ""} événement{more > 1 ? "s" : ""} ce mois-ci</div>}
      </>) : null}
      {(n === 0 || (n <= 9 && !withCards)) && (
        <div style={{ marginTop: n ? 14 : 0, background: "#f6efe3", border: "2px dashed #d9c6a3", borderRadius: 18, padding: "12px 16px", fontSize: 14, color: "#4a4333", lineHeight: 1.4 }}>
          <b style={{ color: "#17140f" }}>Envie de jouer ?</b> Renseignements et réservations auprès du club.
        </div>
      )}
    </div>
  );
}

function CalendarModel({ m, list, showWho, extra = 0 }: { m: string; list: ClubEvent[]; showWho: boolean; extra?: number }) {
  const days = monthDays(m);
  const rows = days.length / 7;
  const noted = list.filter((e) => e.note).slice(0, 5);
  const notesH = noted.length ? 22 + noted.length * 40 : 0;
  const cellH = Math.floor((750 - extra - 30 - 14 - rows * 5 - 10 - notesH) / rows);
  return (
    <div style={{ padding: "0 36px", marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {DAYS.map((d) => <div key={d} style={{ textAlign: "center", fontWeight: 900, fontSize: 13, color: "#fff", background: "#17140f", borderRadius: 8, padding: "5px 0", letterSpacing: "0.08em" }}>{d.slice(0, 3).toUpperCase()}</div>)}
        {days.map((d) => {
          const evs = list.filter((e) => e.startDate <= d && e.endDate >= d); const out = d.slice(0, 7) !== m;
          return (
            <div key={d} style={{ height: cellH, background: out ? "#f3ede0" : "#fff", border: "2px solid #eadfcb", borderRadius: 10, padding: "3px 4px", overflow: "hidden", opacity: out ? 0.5 : 1 }}>
              <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 16, color: "#17140f" }}>{dayNum(d)}</div>
              <div style={{ display: "grid", gap: 2 }}>
                {evs.slice(0, 3).map((e) => <div key={e.id} style={{ background: colorOf(e), color: textOn(colorOf(e)), borderRadius: 5, fontSize: 9.5, fontWeight: 800, lineHeight: 1.15, padding: "1px 4px" }}>{kindOf(e.kind).icon} {label(e)}{showWho && e.who.length ? ` · ${e.who.map((w) => w.replace(" (moi)", "").split(" ")[0]).join(", ")}` : ""}</div>)}
                {evs.length > 3 && <div style={{ fontSize: 9, fontWeight: 800, color: "#6b6557" }}>+{evs.length - 3} autres</div>}
              </div>
            </div>
          );
        })}
      </div>
      {noted.length > 0 && (
        <div style={{ marginTop: 8, background: "#fff", border: "2px solid #eadfcb", borderRadius: 10, padding: "4px 10px" }}>
          {noted.map((e) => (
            <div key={e.id} style={{ height: 40, overflow: "hidden", borderTop: "1px solid #f0e6d2", paddingTop: 2 }}>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: "#17140f" }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: colorOf(e), marginRight: 5 }} />{kindOf(e.kind).icon} {label(e)} <span style={{ fontWeight: 600, color: "#6b6557" }}>· {fullRange(e)}</span></div>
              <div style={{ fontSize: 10.5, color: "#3a352c", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><NoBreak text={glue(e.note)} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Zone libre entre l'en-tête et le bandeau bleu du bas (modèle « liste »).
const BODY_TOP = 296, BODY_BOTTOM = 112, PARTNER_H = 78;
function ListBody({ list, month, showWho, extra = 0, fmt }: { list: ClubEvent[]; month: string; showWho: boolean; extra?: number; fmt?: Fmts }) {
  const g = stepZoom(fmt?.tout?.size);
  const cards = list.length <= 8 || list.some((e) => e.featured);
  const rest = cards ? list.filter((e) => !pickTop(list).includes(e)) : list;
  const refA = useRef<HTMLDivElement>(null); const refB = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, top: 0, gap: 0 });
  // Le texte est agrandi ou réduit (le contenu se remet en page à la nouvelle taille) jusqu'à remplir la zone libre ; le reste est réparti également (haut, milieu, bas).
  useLayoutEffect(() => {
    const avail = POSTER_H - BODY_TOP - BODY_BOTTOM - extra - 16; // marge de 16 px au-dessus du bandeau bleu
    const measure = (s: number) => {
      if (wrap.current) wrap.current.style.width = `${POSTER_W / s}px`;
      // un titre qui ne se coupe pas ne doit jamais dépasser de sa carte : sinon on réduit
      for (const el of Array.from(wrap.current?.querySelectorAll("[data-nw]") ?? [])) { const card = el.closest("[data-card]"); if (card && el.getBoundingClientRect().right > card.getBoundingClientRect().right - 12 * s) return Infinity; }
      return ((refA.current?.offsetHeight ?? 0) + (refB.current?.offsetHeight ?? 0)) * s;
    };
    const run = () => {
      let lo = 0.4, hi = cards ? 1.5 : 2;
      if (measure(hi) <= avail) lo = hi; else for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (measure(mid) <= avail) lo = mid; else hi = mid; }
      const used = measure(lo); const left = Math.max(0, avail - used); const hasA = cards && (refA.current?.offsetHeight ?? 0) > 0;
      if (wrap.current) wrap.current.style.width = `${POSTER_W / (lo * g)}px`; // la largeur calculée par React peut être périmée : on la remet à jour tout de suite
      setFit({ scale: lo, top: hasA ? left / 3 : left / 2, gap: hasA ? left / 3 / lo : 0 });
    };
    run();
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    let live = true; fonts?.ready.then(() => { if (live) run(); });
    return () => { live = false; };
  }, [list, month, showWho, cards, extra, g]);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: BODY_TOP, height: POSTER_H - BODY_TOP - BODY_BOTTOM - extra, overflow: "hidden" }}>
      <div ref={wrap} style={{ transform: `translateY(${fit.top}px) scale(${fit.scale * g})`, transformOrigin: "top left", width: POSTER_W / (fit.scale * g) }}>
        <div ref={refA} style={{ display: "flow-root" }}>{cards && <Featured list={list} showWho={showWho} />}</div>
        <div style={{ height: fit.gap }} />
        <div ref={refB} style={{ display: "flow-root" }}><ListModel m={month} list={rest} showWho={showWho} withCards={cards} /></div>
      </div>
    </div>
  );
}

export function ClubPoster({ events, month, model, showWho, partners, bg = "", fmt, onPick }: { events: ClubEvent[]; month: string; model: PosterModel; showWho: boolean; partners?: string[]; bg?: string; fmt?: Fmts; onPick?: (key: string) => void }) {
  const list = monthEvents(events, month);
  const logos = partners ?? []; const extra = logos.length ? PARTNER_H : 0;
  return (
    <div onClick={(ev) => pickFmt(ev, onPick)} style={{ position: "relative", width: POSTER_W, height: POSTER_H, background: "#fbf5ea", color: "#222", overflow: "hidden", fontFamily: "system-ui, sans-serif", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <FmtStyle fmts={fmt} />
      <Backdrop bg={bg} w={POSTER_W} h={POSTER_H} veil="strong" />
      <Header m={month} z={stepZoom(fmt?.tout?.size)} />
      <div style={{ marginTop: 6 }}>
        {list.length === 0 ? <Empty /> : model === "liste" ? <ListBody list={list} month={month} showWho={showWho} extra={extra} fmt={fmt} /> : <CalendarModel m={month} list={list} showWho={showWho} extra={extra} />}
      </div>
      {logos.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, height: PARTNER_H, background: "#fff", borderTop: "3px solid #7b5d2a", display: "flex", alignItems: "center", gap: 16, padding: "0 40px" }}>
          <div style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", color: "#7b5d2a", lineHeight: 1.3 }}>NOS<br />PARTENAIRES</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-around", gap: 12, height: PARTNER_H - 24 }}>
            {logos.map((l, i) => <img key={i} src={l} alt="" style={{ flex: "1 1 0", minWidth: 0, maxWidth: 150, height: "100%", objectFit: "contain" }} />)}
          </div>
        </div>
      )}
      <Footer events={list} />
    </div>
  );
}
