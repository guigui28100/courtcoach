import { addDays, ClubEvent, colorOf, DAYS, kindOf, mondayOf, MONTHS, seasonOf, teamCat, textOn, titleOf, weekdayOf } from "../clubPlan";

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
const label = (e: ClubEvent) => (e.kind === "EQUIPES" && !e.title ? "Match par équipes" : titleOf(e));
const dayNum = (d: string) => +d.slice(8, 10);
// Date complète : « Samedi 14 novembre » ou « Samedi 14 → dimanche 15 novembre »
const fullRange = (e: ClubEvent) => {
  const d = (x: string, month: boolean) => `${DAYS[weekdayOf(x)]} ${dayNum(x)}${month ? " " + MONTHS[+x.slice(5, 7) - 1].toLowerCase() : ""}`;
  if (e.startDate === e.endDate) return d(e.startDate, true);
  const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
  return `${d(e.startDate, !same)} → ${d(e.endDate, true).replace(/^./, (c) => c.toLowerCase())}`;
};
const rangeText = (e: ClubEvent) => {
  if (e.startDate === e.endDate) return `${DAYS[weekdayOf(e.startDate)]} ${dayNum(e.startDate)}`;
  const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
  return `${DAYS[weekdayOf(e.startDate)].slice(0, 3)}. ${dayNum(e.startDate)}${same ? "" : " " + MONTHS[+e.startDate.slice(5, 7) - 1].toLowerCase()} → ${DAYS[weekdayOf(e.endDate)].slice(0, 3)}. ${dayNum(e.endDate)}`;
};

const Ball = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="48" fill="#d9e84a" stroke="#fff" strokeWidth="3" />
    <path d="M10 26 C40 42 40 58 10 74" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    <path d="M90 26 C60 42 60 58 90 74" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

function Header({ m }: { m: string }) {
  const year = +m.slice(0, 4); const s = seasonOf(`${m}-01`);
  return (
    <div style={{ position: "relative", height: 290, background: "linear-gradient(135deg,#d0592b 0%,#a63e1a 55%,#7d2c12 100%)", color: "#fff", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)" }}>
      <svg aria-hidden="true" width="794" height="290" viewBox="0 0 794 290" style={{ position: "absolute", inset: 0, opacity: 0.22 }} fill="none" stroke="#fff" strokeWidth="4">
        <rect x="40" y="40" width="714" height="230" /><line x1="397" y1="40" x2="397" y2="270" /><line x1="40" y1="95" x2="754" y2="95" /><line x1="40" y1="215" x2="754" y2="215" /><line x1="215" y1="95" x2="215" y2="215" /><line x1="579" y1="95" x2="579" y2="215" /><line x1="215" y1="155" x2="579" y2="155" />
      </svg>
      <div style={{ position: "absolute", right: 30, top: 28, transform: "rotate(-12deg)", filter: "drop-shadow(0 8px 10px rgba(0,0,0,.35))" }}><Ball size={128} /></div>
      <div style={{ position: "absolute", left: 52, top: 40 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.32em", opacity: 0.95 }}>TENNIS CLUB HOUDAN</div>
        <div className="font-display" style={{ fontSize: 84, fontWeight: 900, lineHeight: 1, letterSpacing: "0.02em", marginTop: 8, textShadow: "0 4px 0 rgba(0,0,0,.18)" }}>{MONTHS[+m.slice(5, 7) - 1].toUpperCase()}</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <span style={{ background: "#f2d230", color: "#3a2c00", fontWeight: 900, fontSize: 24, borderRadius: 999, padding: "2px 18px" }}>{year}</span>
          <span style={{ fontWeight: 700, fontSize: 19, opacity: 0.95 }}>Saison {s} – {s + 1} · Au programme ce mois-ci</span>
        </div>
      </div>
    </div>
  );
}

function Footer({ events }: { events: ClubEvent[] }) {
  const kinds = [...new Set(events.map((e) => e.kind))].map(kindOf);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 86, background: "#1b1863", color: "#fff", padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "0.04em" }}>🎾 Tennis Club Houdan</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>4 courts couverts · terre battue et dur · septembre → mai</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "flex-end", maxWidth: 360, fontSize: 12 }}>
        {kinds.map((k) => <span key={k.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 11, height: 11, borderRadius: 3, background: k.color, display: "inline-block" }} />{k.label}</span>)}
      </div>
    </div>
  );
}

function MiniMonth({ m, events }: { m: string; events: ClubEvent[] }) {
  const days = monthDays(m);
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: "12px 14px", border: "2px solid #eadfcb" }}>
      <div style={{ fontWeight: 900, color: "#1b1863", fontSize: 14, marginBottom: 6 }}>LE MOIS D'UN COUP D'ŒIL</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center", fontSize: 11 }}>
        {SHORT.map((d) => <b key={d} style={{ color: "#8a8170", fontSize: 9 }}>{d[0]}</b>)}
        {days.map((d) => {
          const evs = events.filter((e) => e.startDate <= d && e.endDate >= d);
          const out = d.slice(0, 7) !== m;
          return (
            <div key={d} style={{ opacity: out ? 0.25 : 1, height: 32, borderRadius: 7, background: evs.length && !out ? "#f6efe3" : "transparent", paddingTop: 2 }}>
              <div style={{ fontWeight: 800, color: "#1b1863" }}>{dayNum(d)}</div>
              <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 1 }}>{evs.slice(0, 3).map((e) => <i key={e.id} style={{ width: 6, height: 6, borderRadius: 3, background: colorOf(e), display: "inline-block" }} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ margin: "40px 52px", textAlign: "center", fontSize: 24, color: "#6b6557", fontWeight: 700 }}>🎾 Le programme de ce mois arrive bientôt…</div>;
}

function Featured({ list, showWho }: { list: ClubEvent[]; showWho: boolean }) {
  const top = [...list].filter((e) => PRIORITY.includes(e.kind) && !["INSCRIPTIONS", "DEBUT_COURS", "FIN_COURS"].includes(e.kind)).sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind)).slice(0, 3).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (top.length === 0) return null;
  return (
    <div style={{ padding: "0 40px" }}>
      <div style={{ fontWeight: 900, color: "#a63e1a", letterSpacing: "0.12em", fontSize: 15, marginBottom: 8 }}>★ À NE PAS MANQUER</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${top.length}, 1fr)`, gap: 14 }}>
        {top.map((e) => { const k = kindOf(e.kind); const c = colorOf(e); return (
          <div key={e.id} style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 6px 14px rgba(27,24,99,.14)", border: "2px solid #eadfcb" }}>
            <div style={{ background: c, color: textOn(c), padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.08em" }}>{SHORT[weekdayOf(e.startDate)]} {dayNum(e.startDate)}{e.startDate !== e.endDate ? ` → ${SHORT[weekdayOf(e.endDate)]} ${dayNum(e.endDate)}` : ""} {["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"][+e.endDate.slice(5, 7) - 1]}.</span><span style={{ fontSize: 30 }}>{k.icon}</span>
            </div>
            <div style={{ padding: "8px 14px 14px" }}>
              <div className="font-display" style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: "#1b1863" }}>{dayNum(e.startDate)}{e.startDate !== e.endDate && e.startDate.slice(0, 7) === e.endDate.slice(0, 7) ? <small style={{ fontSize: 28 }}>–{dayNum(e.endDate)}</small> : null}</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#1b1863", marginTop: 4, lineHeight: 1.15 }}>{label(e)}</div>
              <div style={{ fontSize: 12.5, color: "#6b6557", marginTop: 4, lineHeight: 1.3 }}>{fullRange(e)}{detail(e, showWho) ? ` · ${detail(e, showWho)}` : ""}</div>
              {e.note && <div style={{ fontSize: 12, color: "#3b3a52", marginTop: 4, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.note}</div>}
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}

function ListModel({ m, list, showWho }: { m: string; list: ClubEvent[]; showWho: boolean }) {
  const n = list.length;
  const mode = n <= 6 ? "normal" : n <= 11 ? "dense" : "compact";
  const roomy = mode === "compact" && n <= 18;
  const side = mode !== "compact";
  const rows = list.map((e) => { const c = colorOf(e); const k = kindOf(e.kind); const multi = e.startDate !== e.endDate; const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7); return (
    <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", background: "#fff", borderRadius: 14, padding: mode === "normal" ? "9px 12px" : mode === "dense" ? "5px 10px" : roomy ? "7px 9px" : "3px 8px", border: "2px solid #eadfcb" }}>
      <div style={{ minWidth: mode === "compact" ? 52 : 62, textAlign: "center", background: c, color: textOn(c), borderRadius: 10, padding: mode === "compact" ? "2px 0" : "4px 0", lineHeight: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>{SHORT[weekdayOf(e.startDate)]}</div>
        <div className="font-display" style={{ fontSize: mode === "compact" ? (roomy ? 20 : 17) : multi ? 21 : 27, fontWeight: 900 }}>{dayNum(e.startDate)}{multi && same ? `–${dayNum(e.endDate)}` : ""}</div>
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
      <div>
        <div style={{ fontWeight: 900, color: "#a63e1a", letterSpacing: "0.12em", fontSize: 15, marginBottom: 8 }}>📅 TOUT LE PROGRAMME</div>
        <div style={{ display: "grid", gridTemplateColumns: side ? "1fr" : "1fr 1fr", gap: mode === "normal" ? 10 : roomy ? 9 : 6, alignContent: "start" }}>{rows}</div>
      </div>
      {side && (
        <div style={{ display: "grid", gap: 14, alignContent: "start", marginTop: 26 }}>
          <MiniMonth m={m} events={list} />
          <div style={{ background: "#f6efe3", border: "2px dashed #d9c6a3", borderRadius: 18, padding: "12px 14px", fontSize: 13, color: "#4a4333", lineHeight: 1.4 }}>
            <b style={{ color: "#1b1863" }}>Envie de jouer ?</b><br />Renseignements et réservations auprès du club.
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarModel({ m, list, showWho }: { m: string; list: ClubEvent[]; showWho: boolean }) {
  const days = monthDays(m);
  const rows = days.length / 7;
  const cellH = Math.floor((761 - 30 - 14 - rows * 5 - 10) / rows);
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
    </div>
  );
}

export function ClubPoster({ events, month, model, showWho }: { events: ClubEvent[]; month: string; model: PosterModel; showWho: boolean }) {
  const list = monthEvents(events, month);
  return (
    <div style={{ position: "relative", width: POSTER_W, height: POSTER_H, background: "#fbf5ea", color: "#222", overflow: "hidden", fontFamily: "system-ui, sans-serif", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <Header m={month} />
      <div style={{ marginTop: 6 }}>
        {list.length === 0 ? <Empty /> : model === "liste" ? (<>{list.length <= 8 && <Featured list={list} showWho={showWho} />}<ListModel m={month} list={list} showWho={showWho} /></>) : <CalendarModel m={month} list={list} showWho={showWho} />}
      </div>
      <Footer events={list} />
    </div>
  );
}
