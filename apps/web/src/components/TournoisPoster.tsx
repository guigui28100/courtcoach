import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ClubEvent, colorOf, DAYS, MONTHS, seasonOf, titleOf, todayParis, weekdayOf } from "../clubPlan";
import { Backdrop } from "./PosterBackdrop";
import { CourtLines } from "./CourtLines";
import { SERIF } from "./posterFonts";
import { POSTER_H, POSTER_W } from "./ClubPoster";
import { PosterStudio, Sec, Seg, Toggle } from "./PosterStudio";
import { FmtStyle, Fmts, pickFmt, txt } from "./posterFmt";
import { FmtItem } from "./FmtPanel";

const safe = (s: string) => s.replace(/[^a-z0-9]/gi, "");

// Affiche « Calendrier des tournois » sur plusieurs mois (A4). Simple : date, nom du tournoi, surface. Rien n'est enregistré : tout se calcule dans le navigateur.
const monthOf = (d: string) => d.slice(0, 7);
const dayNum = (d: string) => +d.slice(8, 10);
const mLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
const addMonth = (m: string, n: number) => { const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };

export function tournoisInPeriod(events: ClubEvent[], from: string, to: string, withTentative: boolean) {
  const a = `${from}-01`, b = `${to}-31`;
  return events.filter((e) => e.kind === "TOURNOI" && e.startDate <= b && e.endDate >= a && (withTentative || !e.tentative)).sort((x, y) => x.startDate.localeCompare(y.startDate));
}
// Tournoi de jeunes ? (le détail « Jeunes · … » est gardé dans `audience` ; repli sur les mots du titre pour les anciens tournois)
export type Pub = "enfants" | "adultes";
export const isKids = (e: ClubEvent) => {
  const a = (e.audience ?? "").toLowerCase();
  if (a) return a.startsWith("jeunes") || /\b(garçons?|filles?)\b|\d+\/\d+ ans/.test(a);
  return /jeunes|garçons|filles|\d+\/\d+ ans/i.test(e.title ?? "");
};
const rangeShort = (e: ClubEvent) => {
  if (e.startDate === e.endDate) return { top: DAYS[weekdayOf(e.startDate)].slice(0, 3).toUpperCase() + ".", big: String(dayNum(e.startDate)) };
  return { top: `${DAYS[weekdayOf(e.startDate)].slice(0, 3)}. → ${DAYS[weekdayOf(e.endDate)].slice(0, 3)}.`.toUpperCase(), big: `${dayNum(e.startDate)}–${dayNum(e.endDate)}` };
};
const Logo = ({ size, color = "#fff", style }: { size: number; color?: string; style?: React.CSSProperties }) => (
  <span aria-hidden style={{ display: "inline-block", width: size, height: size, background: color, WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", ...style }} />
);

export function TournoisPoster({ events, from, to, bg = "", pub = "adultes", fmt, onPick }: { events: ClubEvent[]; from: string; to: string; bg?: string; pub?: Pub; fmt?: Fmts; onPick?: (key: string) => void }) {
  const groups: { m: string; list: ClubEvent[] }[] = [];
  for (const e of events) { const m = monthOf(e.startDate < `${from}-01` ? `${from}-01` : e.startDate); const g = groups.find((x) => x.m === m); g ? g.list.push(e) : groups.push({ m, list: [e] }); }
  const n = events.length, HEAD = 230, FOOT = 96, avail = POSTER_H - HEAD - FOOT - 56;
  const z = 1;
  const gz = 1 + (fmt?.tout?.size ?? 0) * 0.08; // « tous les textes » : appliqué APRÈS l'ajustement automatique
  // la liste est mesurée puis agrandie ou réduite pour remplir exactement la place (jamais coupée)
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const sig = events.map((e) => e.id + e.title + e.startDate + e.endDate + (e.place ?? "")).join("|") + JSON.stringify(fmt);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    el.style.zoom = "1"; el.setAttribute("data-measuring", ""); // pendant la mesure : textes déplacés ou agrandis remis à leur taille de départ
    const h = el.scrollHeight;
    const nk = h > 0 ? Math.max(0.45, Math.min(n < 4 ? 1.6 : 1.35, avail / h)) : 1;
    el.removeAttribute("data-measuring");
    el.style.zoom = String(nk * gz);
    setK(nk);
  }, [sig, avail, n, gz]);
  const period = from === to ? mLabel(from) : `${MONTHS[+from.slice(5, 7) - 1]} – ${mLabel(to)}`;
  return (
    <div onClick={(ev) => pickFmt(ev, onPick)} style={{ position: "relative", width: POSTER_W, height: POSTER_H, background: "#fbf8f1", overflow: "hidden", fontFamily: "Archivo, 'Atkinson Hyperlegible', system-ui, sans-serif", color: "#17140f", fontVariantNumeric: "lining-nums" }}>
      <FmtStyle fmts={fmt} /><style>{"[data-measuring] [data-fmt]{zoom:1 !important}"}</style>
      <Backdrop bg={bg} w={POSTER_W} h={POSTER_H} veil="strong" />
      <div style={{ position: "relative", height: HEAD, background: "linear-gradient(135deg,#2b261d 0%,#17140f 60%)", color: "#fff", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)" }}>
        <svg aria-hidden width={POSTER_W} height={HEAD} viewBox={`0 0 ${POSTER_W} ${HEAD}`} style={{ position: "absolute", inset: 0, opacity: 0.2 }} fill="none" stroke="#c9ad77" strokeWidth="4"><CourtLines cx={397} y={18} h={186} netWidth={6} /></svg>
        <Logo size={130} style={{ position: "absolute", right: 34, top: 22 }} />
        <div style={{ position: "absolute", left: 52, top: 34 }}>
          <div data-fmt="entete" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.22em" }}>{txt(fmt, "entete", "TENNIS CLUB HOUDAN")}</div>
          <div data-fmt="titre" style={{ fontFamily: SERIF, fontSize: 74, fontWeight: 900, lineHeight: 1, marginTop: 8, whiteSpace: "nowrap" }}>{txt(fmt, "titre", pub === "enfants" ? "Tournois jeunes" : "Tournois adultes")}</div>
          <div data-fmt="periode" style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, fontStyle: "italic", marginTop: 6, color: "#e8d9a8", whiteSpace: "nowrap" }}>{txt(fmt, "periode", period)}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 44, right: 44, top: HEAD + 20, bottom: FOOT + 12, display: "flex", flexDirection: "column", justifyContent: "center" }}><div ref={box} style={{ zoom: k }}>
        {n === 0 && <p style={{ textAlign: "center", fontSize: 24, color: "#6b6558" }}>Aucun tournoi sur cette période.</p>}
        {groups.map((g) => (
          <section key={g.m}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: `${Math.round(10 * z)}px 0 ${Math.round(6 * z)}px` }}>
              <span data-fmt={`mois-${g.m.replace("-", "")}`} style={{ fontFamily: SERIF, fontSize: Math.round(36 * Math.max(0.8, z)), fontWeight: 900, letterSpacing: "0.04em", color: "#8a6a2c" }}>{txt(fmt, `mois-${g.m.replace("-", "")}`, MONTHS[+g.m.slice(5, 7) - 1].toUpperCase())}</span>
              <span style={{ flex: 1, height: 2, background: "#c9ad77" }} />
            </div>
            {g.list.map((e) => {
              const r = rangeShort(e), c = colorOf(e), q = safe(e.id);
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "7px 0", borderBottom: "1px solid #e4dccb" }}>
                  <div data-fmt={`date-${q}`} style={{ flex: "0 0 auto", width: Math.round(130 * Math.max(0.8, z)), textAlign: "center", background: c, color: "#fff", borderRadius: 8, padding: `${Math.round(5 * z)}px 4px` }}>
                    <div style={{ fontSize: Math.round(12 * Math.max(0.85, z)), fontWeight: 900, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{txt(fmt, `date-${q}`, r.top)}</div>
                    <div style={{ fontFamily: SERIF, fontSize: Math.round(34 * Math.max(0.8, z)), fontWeight: 900, lineHeight: 1.05, whiteSpace: "nowrap" }}>{r.big}</div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div data-fmt={`nom-${q}`} style={{ fontSize: Math.round(25 * Math.max(0.8, z)), fontWeight: 900, lineHeight: 1.15 }}>{txt(fmt, `nom-${q}`, titleOf(e) + (e.tentative ? " (à confirmer)" : ""))}</div>
                    {e.place && <div data-fmt={`lieu-${q}`} style={{ fontSize: Math.round(15 * Math.max(0.85, z)), color: "#5b5446", marginTop: 2 }}>{txt(fmt, `lieu-${q}`, e.place)}</div>}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div></div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FOOT, background: "#17140f", color: "#fff", padding: "14px 40px", display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={44} />
        <div style={{ whiteSpace: "nowrap" }}>
          <div data-fmt="club" style={{ fontWeight: 900, fontSize: 20, letterSpacing: "0.04em" }}>{txt(fmt, "club", "Tennis Club Houdan")}</div>
          <div data-fmt="mail" style={{ fontSize: 14, fontWeight: 800, color: "#dfcb98" }}>{txt(fmt, "mail", "✉️ tennisclubhoudan@gmail.com")}</div>
        </div>
      </div>
    </div>
  );
}

// Fenêtre : on choisit le premier et le dernier mois (janvier → avril de la saison par défaut)
export function TournoisModal({ events, onClose }: { events: ClubEvent[]; onClose: () => void }) {
  const s = seasonOf(todayParis());
  const [from, setFrom] = useState(`${s + 1}-01`);
  const [to, setTo] = useState(`${s + 1}-04`);
  const [withTentative, setWithTentative] = useState(false);
  const [pub, setPub] = useState<Pub>("enfants");
  const [bg, setBg] = useState("");
  const [fmt, setFmt] = useState<Fmts>({});
  const [sel, setSel] = useState("titre");
  const months = Array.from({ length: 12 }, (_, i) => addMonth(`${s}-09`, i));
  const list = useMemo(() => tournoisInPeriod(events, from, to, withTentative).filter((e) => (pub === "enfants") === isKids(e)), [events, from, to, withTentative, pub]);
  const selCls = "w-full rounded-md border-2 border-line bg-white px-2 py-2 text-sm font-bold text-ink";
  const months2 = [...new Set(list.map((e) => (e.startDate < `${from}-01` ? `${from}-01` : e.startDate).slice(0, 7)))];
  const fmtItems: FmtItem[] = [
    { key: "entete", label: "Nom du club (bandeau du haut)", edit: true }, { key: "titre", label: "Titre", edit: true }, { key: "periode", label: "Période (sous le titre)", edit: true },
    ...months2.map((m) => ({ key: `mois-${m.replace("-", "")}`, label: `Mois : ${MONTHS[+m.slice(5, 7) - 1]}`, edit: true })),
    ...list.flatMap((e, i) => { const q = safe(e.id), nm = `Tournoi ${i + 1}`; return [
      { key: `date-${q}`, label: `${nm} · date`, edit: true }, { key: `nom-${q}`, label: `${nm} · nom`, edit: true }, ...(e.place ? [{ key: `lieu-${q}`, label: `${nm} · surface`, edit: true }] : []),
    ] as FmtItem[]; }),
    { key: "club", label: "Nom du club (bas)", edit: true }, { key: "mail", label: "E-mail (bas)", edit: true }, { key: "tout", label: "Tous les textes", sizeOnly: true },
  ];
  return (
    <PosterStudio
      title={pub === "enfants" ? "🏆 Affiche des tournois jeunes" : "🏆 Affiche des tournois adultes"} subtitle={`${from <= to ? mLabel(from) + " → " + mLabel(to) : "Choisis une période"} · ${list.length} tournoi${list.length > 1 ? "s" : ""}`} onClose={onClose}
      formats={[{ id: "A4", label: "A4", w: POSTER_W, h: POSTER_H }]} format="A4" onFormat={() => {}}
      content={<>
        <Sec title="Pour qui ?">
          <Seg label="Public" value={pub} options={[{ id: "enfants", label: "🧒 Tournois jeunes" }, { id: "adultes", label: "🎾 Tournois adultes" }]} onChange={setPub} />
        </Sec>
        <Sec title="Quelle période ?">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-extrabold text-ink">Du mois de
              <select className={selCls} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }}>{months.map((m) => <option key={m} value={m}>{mLabel(m)}</option>)}</select></label>
            <label className="text-xs font-extrabold text-ink">Au mois de
              <select className={selCls} value={to} onChange={(e) => { setTo(e.target.value); if (e.target.value < from) setFrom(e.target.value); }}>{months.map((m) => <option key={m} value={m}>{mLabel(m)}</option>)}</select></label>
          </div>
          <p className="mb-0 mt-2 text-xs text-muted">L'affiche reprend tous les tournois (TMC et open) du public choisi, pris dans le planning, sur ces mois, rangés par date.</p>
        </Sec>
        <Sec title="Tournois à confirmer"><Toggle on={withTentative} onChange={setWithTentative} label="⏳ Montrer aussi les prévisionnels" hint="Écrits « (à confirmer) » sur l'affiche" /></Sec>
        {list.length > 14 && <p className="rounded-md bg-[#fff3c4] p-2 text-xs font-bold text-ink">Il y a beaucoup de tournois : le texte est petit (tu peux le grossir dans l'onglet « 3 · Textes »). Choisis moins de mois pour une affiche plus lisible.</p>}
      </>}
      bg={bg} onBg={setBg}
      fmt={{ items: fmtItems, value: fmt, onChange: setFmt, selected: sel, onSelect: setSel }}
      preview={({ pick }) => <TournoisPoster events={list} from={from} to={to} bg={bg} pub={pub} fmt={fmt} onPick={pick} />}
      printNode={<TournoisPoster events={list} from={from} to={to} bg={bg} pub={pub} fmt={fmt} />}
      fileBase={() => `affiche-tournois-${pub}-${from}-${to}`}
      save={{ kind: "local", text: "● Rien à enregistrer : tout vient du planning" }}
    />
  );
}
