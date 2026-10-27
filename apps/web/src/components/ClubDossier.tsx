import { SERIF } from "./posterFonts";
// Dossier de saison : un vrai document A4 (couverture, saison en un coup d'œil, une page par mois). Dessiné en HTML dans le navigateur, imprimé ou enregistré en PDF : rien n'est envoyé sur Internet.
import type { CSSProperties, ReactNode } from "react";
import { NoBreak } from "./NoBreak";
import { addDays, ClubEvent, DAYS, kindOf, MONTHS, weekdayOf } from "../clubPlan";
import { inPeriod, nameOf } from "../clubExport";
import { ClubLogo } from "./ui";

export const DOSSIER_W = 794, DOSSIER_H = 1123;
const NAVY = "#17140f", CLAY = "#7b5d2a", GOLD = "#c9ad77", INK = "#17140f", MUTED = "#5e574a", LINE = "#ddd3c0";
const FONT = "Archivo, system-ui, sans-serif";
export interface DossierOpts { from: string; to: string; withWho: boolean; season?: number; cover: boolean }

const short = (d: string) => `${DAYS[weekdayOf(d)].slice(0, 3)}. ${+d.slice(8, 10)}`;
const dateLabel = (e: ClubEvent) => (e.startDate === e.endDate ? short(e.startDate) : `${short(e.startDate)} – ${short(e.endDate).toLowerCase()}`);
const prices = (e: ClubEvent) => (e.formulas ?? []).filter((f) => f.label || f.price || f.priceMember).map((f) => `${f.label ? `${f.label} : ` : ""}${[f.priceMember && `adhérent ${f.priceMember}`, f.price && (f.priceMember ? `non adhérent ${f.price}` : f.price)].filter(Boolean).join(" · ")}`).join(" · ");
const where = (e: ClubEvent) => [e.place, e.courts.length ? `Court${e.courts.length > 1 ? "s" : ""} ${e.courts.join(", ")}` : ""].filter(Boolean).join(" · ");
const details = (e: ClubEvent, withWho: boolean) => [e.time, e.kind === "EQUIPES" ? "" : e.audience, prices(e), e.signup && `Inscriptions : ${e.signup}`, withWho && e.who.length ? `Avec : ${e.who.join(", ")}` : ""].filter(Boolean).join(" · ");
const monthsBetween = (from: string, to: string) => { const out: string[] = []; let m = from.slice(0, 7); while (m <= to.slice(0, 7)) { out.push(m); m = addDays(`${m}-28`, 5).slice(0, 7); } return out; };
const touches = (e: ClubEvent, m: string) => e.startDate.slice(0, 7) <= m && e.endDate.slice(0, 7) >= m;
const monthLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;

const Frame = ({ children, n, total, style }: { children: ReactNode; n: number; total: number; style?: CSSProperties }) => (
  <div className="dossier-page" style={{ width: DOSSIER_W, height: DOSSIER_H, background: "#fff", position: "relative", overflow: "hidden", fontFamily: FONT, color: INK, breakAfter: "page", display: "flex", flexDirection: "column", ...style }}>
    {children}
    <div style={{ position: "absolute", left: 40, right: 40, bottom: 20, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7a7261", borderTop: `1.5px solid ${LINE}`, paddingTop: 8 }}><span>Tennis Club Houdan · Planning de la saison</span><span>{n} / {total}</span></div>
  </div>
);
// Corps d'une page : remplit toute la hauteur entre l'en-tête et le pied ; les blocs sont répartis (rien de collé en haut, rien de vide en bas)
const Body = ({ children, center }: { children: ReactNode; center?: boolean }) => (
  <div style={{ flex: 1, minHeight: 0, padding: "24px 40px 60px", display: "flex", flexDirection: "column", justifyContent: center ? "center" : "space-between", gap: 14 }}>{children}</div>
);
const Head = ({ title, sub }: { title: string; sub: string }) => (
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: 16, background: NAVY, color: "#fff", padding: "20px 40px" }}>
      <div style={{ width: 46, height: 46, color: "#fff" }}><ClubLogo className="size-full" label="Tennis Club Houdan" /></div>
      <div><div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{title}</div><div style={{ fontSize: 13, opacity: .8, marginTop: 2 }}>{sub}</div></div>
    </div>
    <div style={{ height: 8, background: "linear-gradient(90deg,#D35400,#8E44AD,#27AE60,#A04000,#2C3E50,#2E86C1)" }} />
  </div>
);

function Legend({ list }: { list: ClubEvent[] }) {
  const kinds = [...new Map(list.map((e) => [kindOf(e.kind).label, kindOf(e.kind).color])).entries()].slice(0, 10);
  return <div style={{ display: "flex", gap: "6px 16px", flexWrap: "wrap", fontSize: 12, fontWeight: 700 }}>{kinds.map(([l, c]) => <span key={l}><i style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", background: c, marginRight: 6 }} />{l}</span>)}</div>;
}

function MiniMonth({ m, list }: { m: string; list: ClubEvent[] }) {
  const y = +m.slice(0, 4), mo = +m.slice(5, 7); const lead = weekdayOf(`${m}-01`); const nd = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: nd }, (_, i) => i + 1)]; while (cells.length % 7) cells.push(null);
  const colorOf = (d: number) => { const ds = `${m}-${String(d).padStart(2, "0")}`; const e = list.find((x) => x.startDate <= ds && x.endDate >= ds && !kindOf(x.kind).key.startsWith("BULLE_")) ?? list.find((x) => x.startDate <= ds && x.endDate >= ds); return e ? kindOf(e.kind).color : ""; };
  return (
    <div style={{ border: `2px solid ${LINE}`, borderRadius: 12, padding: "8px 10px", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: CLAY, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{monthLabel(m)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", fontSize: 11, textAlign: "center", flex: 1, alignContent: "space-evenly" }}>
        {"LMMJVSD".split("").map((d, i) => <b key={i} style={{ color: "#9a9180", fontWeight: 700 }}>{d}</b>)}
        {cells.map((d, i) => { const c = d ? colorOf(d) : ""; return <span key={i} style={{ height: 17, lineHeight: "17px", width: 17, margin: "0 auto", borderRadius: "50%", background: c || "transparent", color: c ? "#fff" : INK, fontWeight: c ? 800 : 400 }}>{d ?? ""}</span>; })}
      </div>
    </div>
  );
}

function BigMonth({ m, list }: { m: string; list: ClubEvent[] }) {
  const lead = weekdayOf(`${m}-01`); const nd = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: nd }, (_, i) => i + 1)]; while (cells.length % 7) cells.push(null);
  const rows = cells.length / 7;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gridTemplateRows: `auto repeat(${rows},minmax(0,1fr))`, border: `1.5px solid #ddd3c0` }}>
      {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d} style={{ background: INK, color: "#fff", textAlign: "center", padding: 6, fontSize: 12, fontWeight: 800 }}>{d}</div>)}
      {cells.map((d, i) => {
        const ds = d ? `${m}-${String(d).padStart(2, "0")}` : ""; const evs = d ? list.filter((e) => e.startDate <= ds && e.endDate >= ds && !kindOf(e.kind).key.startsWith("BULLE_")) : [];
        return (
          <div key={i} style={{ minHeight: 0, borderTop: `1.5px solid #ddd3c0`, borderLeft: i % 7 ? `1.5px solid #ddd3c0` : "none", padding: 4, background: !d ? "#f1ebdd" : i % 7 >= 5 ? "#faf6ee" : "#fff", overflow: "hidden", minWidth: 0 }}>
            {d && <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1 }}>{d}</div>}
            {evs.slice(0, 3).map((e) => <div key={e.id} style={{ marginTop: 3, background: kindOf(e.kind).color, color: "#fff", borderRadius: 5, padding: "2px 5px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kindOf(e.kind).icon} {nameOf(e)}</div>)}
            {evs.length > 3 && <div style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: MUTED }}>+ {evs.length - 3} autre{evs.length > 4 ? "s" : ""}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Program({ list, withWho }: { list: ClubEvent[]; withWho: boolean }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>{list.map((e) => { const k = kindOf(e.kind); const sub = details(e, withWho); return (
        <tr key={e.id} style={{ borderBottom: `1.5px solid ${LINE}`, verticalAlign: "top" }}>
          <td style={{ padding: "9px 8px 9px 0", fontWeight: 800, width: 132 }}>{dateLabel(e)}{e.featured ? " ⭐" : ""}</td>
          <td style={{ padding: "9px 8px", width: 108 }}><span style={{ background: k.color, color: "#fff", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{k.group === "Compétition" ? "Compétition" : k.label.length > 16 ? k.label.slice(0, 15) + "…" : k.label}</span></td>
          <td style={{ padding: "9px 8px" }}><b>{k.icon} {nameOf(e)}</b>{sub ? <div style={{ color: MUTED, fontSize: 12, marginTop: 1 }}><NoBreak text={sub} /></div> : null}{e.note ? <div style={{ color: "#3a352c", fontSize: 12, marginTop: 2, overflowWrap: "break-word" }}><NoBreak text={e.note.length > 240 ? e.note.slice(0, 239) + "…" : e.note} /></div> : null}</td>
          <td style={{ padding: "9px 0 9px 8px", width: 110, fontSize: 12, color: MUTED }}>{where(e)}</td>
        </tr>); })}</tbody>
    </table>
  );
}

// Fabrique la liste des pages
export function buildDossier(events: ClubEvent[], o: DossierOpts): ReactNode[] {
  const list = inPeriod(events, o.from, o.to);
  const months = monthsBetween(o.from, o.to);
  type P = (n: number, t: number) => ReactNode; const pages: P[] = [];
  const title = o.season ? `${o.season} / ${o.season + 1}` : monthLabel(o.from.slice(0, 7));
  const stats = [[list.length, "événements"], [list.filter((e) => e.kind === "TOURNOI" || e.kind === "EQUIPES").length, "compétitions"], [list.filter((e) => e.kind.startsWith("STAGE")).length, "stages"], [list.filter((e) => ["ANIMATION", "FETE", "FETE_ECOLE"].includes(e.kind)).length, "animations"]];
  if (o.cover) {
    pages.push((n, t) => (
      <Frame key="cover" n={n} total={t} style={{ background: NAVY, color: "#fff" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 560, background: "linear-gradient(160deg,#2b261d,#1c1812)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 560, opacity: .22, background: "repeating-linear-gradient(90deg,transparent 0 118px,#fff 118px 120px)" }} />
        <div style={{ position: "absolute", left: 56, top: 52, width: 96, height: 96, color: "#fff" }}><ClubLogo className="size-full" label="Tennis Club Houdan" /></div>
        <div style={{ position: "absolute", left: 58, top: 236, fontWeight: 800, letterSpacing: ".3em", fontSize: 18, color: GOLD }}>TENNIS CLUB HOUDAN</div>
        <div style={{ position: "absolute", left: 56, top: 280, fontFamily: SERIF, fontSize: 92, lineHeight: .95, fontWeight: 700, letterSpacing: -2 }}>Planning<br />de la saison</div>
        <div style={{ position: "absolute", left: 58, top: 488, fontSize: 32, fontWeight: 700 }}>{title}</div>
        <div style={{ position: "absolute", left: 56, right: 56, top: 560, bottom: 150, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, alignContent: "center" }}>
          {stats.map(([v, l]) => <div key={l as string} style={{ background: "#ffffff14", border: "2px solid #ffffff44", borderRadius: 16, padding: 16 }}><b style={{ display: "block", fontSize: 44, color: GOLD, lineHeight: 1.1 }}>{v}</b><span style={{ fontSize: 14, opacity: .9 }}>{l}</span></div>)}
        </div>
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 50, display: "flex", justifyContent: "space-between", fontSize: 14, opacity: .85, borderTop: "2px solid #fff4", paddingTop: 14 }}><span>Document du bureau · Version du {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span><span style={{ whiteSpace: "nowrap" }}>tennisclubhoudan@gmail.com</span></div>
      </Frame>));
  }
  if (o.season) {
    const top = [...list.filter((e) => e.featured), ...list.filter((e) => !e.featured && (e.kind === "TOURNOI" || e.kind.startsWith("STAGE") || e.kind === "FETE" || e.kind === "FETE_ECOLE"))].slice(0, 3);
    pages.push((n, t) => (
      <Frame key="year" n={n} total={t}>
        <Head title="La saison en un coup d'œil" sub={`Septembre ${o.season} → août ${o.season! + 1}`} />
        <Body>
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gridTemplateRows: "repeat(4,minmax(0,1fr))", gap: 10 }}>{months.map((m) => <MiniMonth key={m} m={m} list={list.filter((e) => touches(e, m))} />)}</div>
          <Legend list={list} />
          {top.length > 0 && <div><div style={{ marginBottom: 4, fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>Les grandes dates</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><tbody>{top.map((e) => <tr key={e.id} style={{ borderBottom: `1.5px solid ${LINE}` }}><td style={{ padding: "6px 8px 6px 0", fontWeight: 800, width: 190 }}>{dateLabel(e)}</td><td style={{ padding: 6 }}><b>{kindOf(e.kind).icon} {nameOf(e)}</b></td></tr>)}</tbody></table></div>}
        </Body>
      </Frame>));
  }
  for (const m of months) {
    const evs = list.filter((e) => touches(e, m)); if (!evs.length) continue;
    const prog = evs;
    // Découpe par hauteur estimée : la 1re page porte le calendrier (peu de place), les suivantes sont presque vides
    const est = (e: ClubEvent) => { const sub = details(e, o.withWho); return 28 + (sub ? 16 * Math.ceil(sub.length / 72) : 0) + (e.note ? 16 * Math.ceil(Math.min(e.note.length, 240) / 78) : 0); };
    const first: ClubEvent[] = [], chunks: ClubEvent[][] = []; let used = 0, cap = 300, cur = first;
    for (const e of prog) { const h = est(e); if (used + h > cap && cur.length) { cur = []; chunks.push(cur); used = 0; cap = 400; } cur.push(e); used += h; }
    pages.push((n, t) => (
      <Frame key={m} n={n} total={t}>
        <Head title={monthLabel(m)} sub={`${evs.length} événement${evs.length > 1 ? "s" : ""}`} />
        <Body>
          <BigMonth m={m} list={evs} />
          <div>
            <div style={{ marginBottom: 4, fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>Au programme</div>
            <Program list={first} withWho={o.withWho} />
          </div>
          <Legend list={evs} />
        </Body>
      </Frame>));
    chunks.forEach((c, i) => pages.push((n, t) => (
      <Frame key={`${m}-${i}`} n={n} total={t}>
        <Head title={`${monthLabel(m)} (suite)`} sub="Au programme" />
        <Body>
          <div style={{ height: 400, display: "flex" }}><BigMonth m={m} list={evs} /></div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>Au programme (suite)</div>
            <Program list={c} withWho={o.withWho} />
          </div>
        </Body>
      </Frame>)));
  }
  return pages.map((p, i) => p(i + 1, pages.length));
}
