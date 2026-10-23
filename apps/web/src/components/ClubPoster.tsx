import { useLayoutEffect, useRef, useState } from "react";
import { addDays, ClubEvent, colorOf, DAYS, kindOf, mondayOf, MONTHS, opponentOf, seasonOf, teamCat, textOn, titleOf, weekdayOf } from "../clubPlan";

// Affiche du mois (format A4 : 794 × 1123 px, tout est dessiné ici : aucune image ni police extérieure)
export const POSTER_W = 794;
export const POSTER_H = 1123;
export type PosterModel = "liste" | "calendrier";

const SHORT = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const PRIORITY = ["FETE", "FETE_ECOLE", "TOURNOI", "STAGE_ENFANTS", "STAGE_ADULTES", "ANIMATION", "EQUIPES", "INSCRIPTIONS", "DEBUT_COURS", "FIN_COURS"];

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
function detail(e: ClubEvent, showWho: boolean) {
  const parts: string[] = [];
  if (e.kind === "EQUIPES" && e.teams.length) parts.push(teamsText(e));
  if (e.bands.length) parts.push(e.bands.map((b) => BAND_TXT[b]).join(" + "));
  if (showWho && e.who.length) parts.push(`avec ${e.who.map((w) => w.replace(" (moi)", "")).join(", ")}`);
  return parts.join(" · ");
}
export const label = (e: ClubEvent) => (e.kind === "EQUIPES" && !e.title ? `Match par équipes${opponentOf(e) ? ` · contre ${opponentOf(e)}` : ""}` : titleOf(e));
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

function Header({ m }: { m: string }) {
  const year = +m.slice(0, 4); const s = seasonOf(`${m}-01`);
  return (
    <div style={{ position: "relative", height: 290, background: "linear-gradient(135deg,#d0592b 0%,#a63e1a 55%,#7d2c12 100%)", color: "#fff", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)" }}>
      <svg aria-hidden="true" width="794" height="290" viewBox="0 0 794 290" style={{ position: "absolute", inset: 0, opacity: 0.22 }} fill="none" stroke="#fff" strokeWidth="4">
        <rect x="40" y="40" width="714" height="230" /><line x1="397" y1="40" x2="397" y2="270" /><line x1="40" y1="95" x2="754" y2="95" /><line x1="40" y1="215" x2="754" y2="215" /><line x1="215" y1="95" x2="215" y2="215" /><line x1="579" y1="95" x2="579" y2="215" /><line x1="215" y1="155" x2="579" y2="155" />
      </svg>
      <PosterLogo size={150} style={{ position: "absolute", right: 30, top: 24, filter: "drop-shadow(0 6px 8px rgba(0,0,0,.3))" }} />
      <div style={{ position: "absolute", left: 52, top: 40 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.32em", opacity: 0.95 }}>TENNIS CLUB HOUDAN</div>
        <div className="font-display" style={{ fontSize: MONTHS[+m.slice(5, 7) - 1].length > 7 ? 68 : 84, fontWeight: 900, lineHeight: 1, letterSpacing: "0.02em", marginTop: 8, textShadow: "0 4px 0 rgba(0,0,0,.18)" }}>{MONTHS[+m.slice(5, 7) - 1].toUpperCase()}</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <span style={{ background: "#f2d230", color: "#3a2c00", fontWeight: 900, fontSize: 24, borderRadius: 999, padding: "2px 18px" }}>{year}</span>
          <span style={{ fontWeight: 700, fontSize: 19, opacity: 0.95 }}>Saison {s} – {s + 1}</span>
        </div>
      </div>
    </div>
  );
}

function Footer({ events }: { events: ClubEvent[] }) {
  const kinds = [...new Set(events.map((e) => e.kind))].map(kindOf);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: "#1b1863", color: "#fff", padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
      <div style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "0.04em" }}><PosterLogo size={26} style={{ verticalAlign: "-6px", marginRight: 8 }} />Tennis Club Houdan</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>4 courts couverts · terre battue et dur · septembre → mai</div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 3, color: "#ffe45c" }}>✉️ tennisclubhoudan@gmail.com</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "flex-end", maxWidth: 330, fontSize: 11.5 }}>
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
      <div className="font-display" style={{ fontWeight: 900, color: "#fff", background: "#a63e1a", letterSpacing: "0.1em", fontSize: 22, marginBottom: 10, display: "inline-block", padding: "5px 18px", borderRadius: 999 }}>★ À NE PAS MANQUER</div>
      <div style={{ display: "grid", gap: 10 }}>
        {top.map((e) => { const k = kindOf(e.kind); const c = colorOf(e); const multi = e.startDate !== e.endDate; const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7); const line = { fontSize: 14, fontWeight: 800, lineHeight: 1.25 } as const; return (
          <div key={e.id} style={{ display: "flex", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 14px rgba(27,24,99,.16)", border: `3px solid ${c}` }}>
            <div style={{ background: c, color: textOn(c), width: 246, flex: "0 0 246px", padding: "10px 16px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "left" }}>
              <div style={line}>{multi ? `Du ${lc(DAYS[weekdayOf(e.startDate)])}` : DAYS[weekdayOf(e.startDate)]}</div>
              <div className="font-display" style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.05 }}>{dayNum(e.startDate)}{multi && !same ? <small style={{ fontSize: 18 }}> {MOIS[+e.startDate.slice(5, 7) - 1]}</small> : null}</div>
              <div style={line}>{multi ? `au ${lc(DAYS[weekdayOf(e.endDate)])} ${dayNum(e.endDate)} ` : ""}{MOIS[+e.endDate.slice(5, 7) - 1]}</div>
            </div>
            <div style={{ padding: "10px 18px", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "left" }}>
              <div style={{ fontWeight: 900, fontSize: 24, color: "#1b1863", lineHeight: 1.15 }}>{k.icon} {label(e)}</div>
              {detail(e, showWho) ? <div style={{ fontSize: 13, fontWeight: 700, color: "#6b6557", marginTop: 3 }}>{detail(e, showWho)}</div> : null}
              {e.note && <div style={{ fontSize: 14, color: "#2b2a42", marginTop: 5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.note}</div>}
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}

function ListModel({ m, list, showWho, withCards }: { m: string; list: ClubEvent[]; showWho: boolean; withCards: boolean }) {
  const n = list.length;
  if (withCards) {
    // sous le grand bandeau : liste sobre et alignée (date complète à gauche, événement à droite)
    const shown = list.slice(0, 10); const more = n - shown.length; const two = n > 6;
    const when = (e: ClubEvent) => { const mo = MONTHS[+e.endDate.slice(5, 7) - 1].toLowerCase(); if (e.startDate === e.endDate) return `${DAYS[weekdayOf(e.startDate)]} ${dayNum(e.startDate)} ${mo}`; return e.startDate.slice(0, 7) === e.endDate.slice(0, 7) ? `Du ${DAYS[weekdayOf(e.startDate)].toLowerCase()} ${dayNum(e.startDate)} au ${DAYS[weekdayOf(e.endDate)].toLowerCase()} ${dayNum(e.endDate)} ${mo}` : fullRange(e); };
    const cell = (e: ClubEvent) => { const k = kindOf(e.kind); return two ? (
      <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid #e3d7bf", padding: "7px 0", textAlign: "left" }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: 5, background: colorOf(e), flex: "0 0 9px", marginTop: 5 }} />
        <span><span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "#1b1863", lineHeight: 1.25 }}>{when(e)}</span><span style={{ display: "block", fontSize: 14, fontWeight: 700, lineHeight: 1.25, marginTop: 1 }}>{k.icon}&nbsp;{label(e)}</span></span>
      </div>
    ) : (
      <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "baseline", borderBottom: "1px solid #e3d7bf", padding: "8px 0", textAlign: "left" }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: 5, background: colorOf(e), flex: "0 0 9px", alignSelf: "center" }} />
        <span style={{ width: 250, flex: "0 0 250px", fontSize: 14, fontWeight: 800, color: "#1b1863", lineHeight: 1.25 }}>{when(e)}</span>
        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{k.icon}&nbsp;{label(e)}</span>
      </div>
    ); };
    return (
      <div style={{ padding: "0 40px", marginTop: 20, textAlign: "left" }}>
        {n > 0 ? (<>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.3em", color: "#a63e1a", marginBottom: 6 }}>ET AUSSI CE MOIS-CI</div>
          <div style={{ display: "grid", gridTemplateColumns: two ? "1fr 1fr" : "1fr", columnGap: 28 }}>{shown.map(cell)}</div>
          {more > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6b6557", marginTop: 8 }}>… et {more} autre{more > 1 ? "s" : ""} événement{more > 1 ? "s" : ""} ce mois-ci</div>}
        </>) : (
          <div style={{ background: "#f6efe3", border: "2px dashed #d9c6a3", borderRadius: 18, padding: "12px 16px", fontSize: 14, color: "#4a4333", lineHeight: 1.4 }}>
            <b style={{ color: "#1b1863" }}>Envie de jouer ?</b> Renseignements et réservations auprès du club.
          </div>
        )}
      </div>
    );
  }
  const mode = n <= (withCards ? 3 : 6) ? "normal" : n <= (withCards ? 4 : 11) ? "dense" : "compact";
  const roomy = mode === "compact" && n <= (withCards ? 14 : 18);
  const side = false; // plus de petit calendrier « le mois d'un coup d'œil » : la liste prend toute la largeur
  const rows = list.map((e) => { const c = colorOf(e); const k = kindOf(e.kind); const multi = e.startDate !== e.endDate; const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7); return (
    <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", background: "#fff", borderRadius: 14, padding: mode === "normal" ? "9px 12px" : mode === "dense" ? "5px 10px" : roomy ? "7px 9px" : "3px 8px", border: "2px solid #eadfcb" }}>
      <div style={{ minWidth: mode === "compact" ? 62 : 74, textAlign: "center", background: c, color: textOn(c), borderRadius: 10, padding: mode === "compact" ? "2px 0" : "4px 0", lineHeight: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>{SHORT[weekdayOf(e.startDate)]}{multi ? `–${SHORT[weekdayOf(e.endDate)]}` : ""}</div>
        <div className="font-display" style={{ fontSize: mode === "compact" ? (roomy ? 20 : 17) : multi ? 21 : 27, fontWeight: 900 }}>{dayNum(e.startDate)}{multi ? `${same ? "–" : "→"}${dayNum(e.endDate)}` : ""}</div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 900, fontSize: mode === "compact" ? (roomy ? 15 : 13.5) : mode === "dense" ? 15 : 17, color: "#1b1863", lineHeight: 1.15 }}>{k.icon} {label(e)}</div>
        <div style={{ fontSize: mode === "compact" ? (roomy ? 11.5 : 10.5) : 12, color: "#6b6557", marginTop: 1, lineHeight: 1.2 }}>{fullRange(e)}{detail(e, showWho) ? ` · ${detail(e, showWho)}` : ""}</div>
        {e.note && <div style={{ fontSize: mode === "compact" ? 10.5 : 11.5, color: "#3b3a52", marginTop: 2, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: mode === "normal" ? 3 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.note}</div>}
      </div>
    </div>
  ); });
  return (
    <div style={{ padding: "0 40px", display: "grid", gridTemplateColumns: side ? "1fr 250px" : "1fr", gap: 22, marginTop: 18 }}>
      {n > 0 && <div>
        <div style={{ fontWeight: 900, color: "#a63e1a", letterSpacing: "0.12em", fontSize: 15, marginBottom: 8 }}>{withCards ? "📅 ET AUSSI CE MOIS-CI" : "📅 TOUT LE PROGRAMME"}</div>
        <div style={{ display: "grid", gridTemplateColumns: mode === "compact" ? "1fr 1fr" : "1fr", gap: mode === "normal" ? 10 : roomy ? 9 : 6, alignContent: "start" }}>{rows}</div>
      </div>}
      {(n === 0 || (n <= 9 && !withCards)) && (
        <div style={{ background: "#f6efe3", border: "2px dashed #d9c6a3", borderRadius: 18, padding: "12px 16px", fontSize: 14, color: "#4a4333", lineHeight: 1.4 }}>
          <b style={{ color: "#1b1863" }}>Envie de jouer ?</b> Renseignements et réservations auprès du club.
        </div>
      )}
    </div>
  );
}

function CalendarModel({ m, list, showWho }: { m: string; list: ClubEvent[]; showWho: boolean }) {
  const days = monthDays(m);
  const rows = days.length / 7;
  const noted = list.filter((e) => e.note).slice(0, 5);
  const notesH = noted.length ? 22 + noted.length * 40 : 0;
  const cellH = Math.floor((750 - 30 - 14 - rows * 5 - 10 - notesH) / rows);
  return (
    <div style={{ padding: "0 36px", marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {DAYS.map((d) => <div key={d} style={{ textAlign: "center", fontWeight: 900, fontSize: 13, color: "#fff", background: "#1b1863", borderRadius: 8, padding: "5px 0", letterSpacing: "0.08em" }}>{d.slice(0, 3).toUpperCase()}</div>)}
        {days.map((d) => {
          const evs = list.filter((e) => e.startDate <= d && e.endDate >= d); const out = d.slice(0, 7) !== m;
          return (
            <div key={d} style={{ height: cellH, background: out ? "#f3ede0" : "#fff", border: "2px solid #eadfcb", borderRadius: 10, padding: "3px 4px", overflow: "hidden", opacity: out ? 0.5 : 1 }}>
              <div className="font-display" style={{ fontWeight: 900, fontSize: 16, color: "#1b1863" }}>{dayNum(d)}</div>
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
              <div style={{ fontSize: 11.5, fontWeight: 900, color: "#1b1863" }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: colorOf(e), marginRight: 5 }} />{kindOf(e.kind).icon} {label(e)} <span style={{ fontWeight: 600, color: "#6b6557" }}>· {fullRange(e)}</span></div>
              <div style={{ fontSize: 10.5, color: "#3b3a52", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Zone libre entre l'en-tête et le bandeau bleu du bas (modèle « liste »).
const BODY_TOP = 296, BODY_BOTTOM = 112;
function ListBody({ list, month, showWho }: { list: ClubEvent[]; month: string; showWho: boolean }) {
  const cards = list.length <= 8 || list.some((e) => e.featured);
  const rest = cards ? list.filter((e) => !pickTop(list).includes(e)) : list;
  const refA = useRef<HTMLDivElement>(null); const refB = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, gap: 0 });
  useLayoutEffect(() => {
    const avail = POSTER_H - BODY_TOP - BODY_BOTTOM;
    const ha = refA.current?.offsetHeight ?? 0; const hb = refB.current?.offsetHeight ?? 0;
    const total = ha + hb;
    if (total > avail) setFit({ scale: avail / total, gap: 0 });
    else setFit({ scale: 1, gap: cards && ha > 0 ? Math.max(0, (avail - total) / 2) : 0 }); // peu d'événements : la suite est centrée dans la place restante
  }, [list, month, showWho, cards]);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: BODY_TOP, height: POSTER_H - BODY_TOP - BODY_BOTTOM, overflow: "hidden" }}>
      <div style={{ transform: `scale(${fit.scale})`, transformOrigin: "top center", width: POSTER_W }}>
        <div ref={refA} style={{ display: "flow-root" }}>{cards && <Featured list={list} showWho={showWho} />}</div>
        <div style={{ height: fit.gap }} />
        <div ref={refB} style={{ display: "flow-root" }}><ListModel m={month} list={rest} showWho={showWho} withCards={cards} /></div>
      </div>
    </div>
  );
}

export function ClubPoster({ events, month, model, showWho }: { events: ClubEvent[]; month: string; model: PosterModel; showWho: boolean }) {
  const list = monthEvents(events, month);
  return (
    <div style={{ position: "relative", width: POSTER_W, height: POSTER_H, background: "#fbf5ea", color: "#222", overflow: "hidden", fontFamily: "system-ui, sans-serif", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <Header m={month} />
      <div style={{ marginTop: 6 }}>
        {list.length === 0 ? <Empty /> : model === "liste" ? <ListBody list={list} month={month} showWho={showWho} /> : <CalendarModel m={month} list={list} showWho={showWho} />}
      </div>
      <Footer events={list} />
    </div>
  );
}
