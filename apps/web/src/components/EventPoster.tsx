import { useLayoutEffect, useRef, useState } from "react";
import { NoBreak, longestLink } from "./NoBreak";
import type { CSSProperties, ReactNode } from "react";
import { ClubEvent, DAYS, kindOf, MONTHS, titleOf, weekdayOf } from "../clubPlan";
import { fullRange, label } from "./ClubPoster";

// Affiche d'UN événement (pour la pub auprès des adhérents) : A4 à imprimer ou carré pour WhatsApp / Facebook.
// Même finition que le dossier de saison : bandeau bleu nuit, titre géant, date en bloc d'honneur, cartes, tableau de tarifs, pied « inscriptions ».
// Tout est dessiné en HTML (aucune image extérieure) et la mise en page REMPLIT toute l'affiche : la taille du contenu s'ajuste (variable --k), le reste de la place est réparti entre les blocs.
export type PosterFormat = "A4" | "CARRE";
export const SIZES: Record<PosterFormat, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, CARRE: { w: 1080, h: 1080 } };
const FONT = "Archivo, ArchivoPoster, 'Arial Narrow', system-ui, sans-serif";
const NAVY = "#1b1863", GOLD = "#f4c20d", LINE = "#e3e6ee", MUTED = "#5b6477";

// Couleur de repère : une par type, et pour un tournoi une par catégorie
const TOURNOI_COLOR: Record<string, string> = { "Messieurs (adultes)": "#1e3a8a", "Dames (adultes)": "#be185d", "Jeunes": "#15a34a" };
export const tourBase = (a: string) => a.split(" · ")[0];
const accentOf = (e: ClubEvent) => (e.kind === "TOURNOI" ? TOURNOI_COLOR[tourBase(e.audience ?? "")] : undefined) ?? kindOf(e.kind).color;

const MON3 = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function dateBlock(e: ClubEvent) {
  const [a, b] = [e.startDate, e.endDate]; const d = (x: string) => +x.slice(8, 10); const m = (x: string) => +x.slice(5, 7) - 1;
  const month = a.slice(0, 7) === b.slice(0, 7) ? `${MONTHS[m(a)]} ${a.slice(0, 4)}` : `${MONTHS[m(a)]} → ${MONTHS[m(b)]} ${b.slice(0, 4)}`;
  if (a === b) return { big: `${DAYS[weekdayOf(a)].slice(0, 3).toUpperCase()}. ${d(a)}`, month: month.toUpperCase() };
  return { big: a.slice(0, 7) === b.slice(0, 7) ? `${d(a)} → ${d(b)}` : `${d(a)} ${MON3[m(a)]} → ${d(b)} ${MON3[m(b)]}`, month: month.toUpperCase() };
}

type Row = { icon: string; title: string; text: string };

export type BlockKey = "titre" | "date" | "infos" | "tarifs" | "texte";
export type BlockFmt = { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; align?: "left" | "center" | "right" };
export type PosterFmt = Partial<Record<BlockKey, BlockFmt>>;

export function EventPoster({ e, format, showWho, fmt }: { e: ClubEvent; format: PosterFormat; showWho: boolean; fmt?: PosterFmt }) {
  const { w, h } = SIZES[format]; const sq = format === "CARRE";
  const kd = kindOf(e.kind); const acc = accentOf(e);
  const name = (e.kind === "EQUIPES" && !e.title ? label(e) : titleOf(e)).toUpperCase();
  const formulas = (e.formulas ?? []).filter((f) => f.label || f.price || f.priceMember);
  const twoPrices = formulas.some((f) => f.priceMember && f.price);
  const tour = e.kind === "TOURNOI"; // tournoi : lieu = surface, horaires = matchs jour par jour, inscriptions = finale
  const rows: Row[] = [];
  if (e.audience) rows.push(e.kind === "EQUIPES" ? { icon: "🏟️", title: "Club rencontré", text: e.audience } : { icon: tour ? "🏷️" : "👥", title: tour && TOURNOI_COLOR[tourBase(e.audience)] ? "Catégorie" : "Pour qui", text: e.audience });
  if (e.place && tour) rows.push({ icon: "🎾", title: "Surface", text: e.place });
  if (e.time) rows.push({ icon: "🕒", title: tour ? "Matchs, jour par jour" : "Horaires", text: e.time });
  if (e.signup && tour) rows.push({ icon: "🏆", title: "Finale", text: e.signup });
  if (e.place && !tour) rows.push({ icon: "📍", title: "Lieu", text: e.place });
  if (e.bring) rows.push({ icon: "🎒", title: "À prévoir", text: e.bring });
  if (showWho && e.who.length) rows.push({ icon: "👤", title: "Avec", text: e.who.join(", ") });
  const inscription = !tour && e.signup ? e.signup : "";
  const dt = dateBlock(e);

  // Taille du contenu : on mesure, puis on agrandit ou réduit pour remplir la place disponible (le reste est réparti entre les blocs)
  const body = useRef<HTMLDivElement>(null); const [k, setK] = useState(1);
  const sig = JSON.stringify([e, format, showWho, fmt]);
  useLayoutEffect(() => {
    const el = body.current; if (!el) return;
    const run = () => {
      const inner = el.firstElementChild as HTMLElement; if (!inner) return;
      const avail = el.clientHeight; let kk = 1; inner.style.height = "auto";
      for (let i = 0; i < 4; i++) {
        el.style.setProperty("--k", String(kk)); const hh = inner.scrollHeight;
        if (hh <= 0) break; const next = Math.max(0.55, Math.min(2.2, kk * (avail * 0.94) / hh)); if (Math.abs(next - kk) < 0.01) { kk = next; break; } kk = next;
      }
      el.style.setProperty("--k", String(kk));
      for (let i = 0; i < 10 && inner.scrollHeight > avail && kk > 0.5; i++) { kk *= 0.96; el.style.setProperty("--k", String(kk)); }
      inner.style.height = "100%"; setK(kk);
    };
    run();
    const fonts = (document as any).fonts; if (fonts?.ready) fonts.ready.then(run).catch(() => {});
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const F = (k: BlockKey): BlockFmt => fmt?.[k] ?? {};
  const pk = (k: BlockKey) => { const f = 1 + (F(k).size ?? 0) * 0.12; return (n: number) => `calc(${n}px * var(--k) * ${f})`; };
  const [pt, pd, pi, pf, pn] = [pk("titre"), pk("date"), pk("infos"), pk("tarifs"), pk("texte")];
  const p = (n: number) => `calc(${n}px * var(--k))`;
  const wt = (k: BlockKey, d: number) => (F(k).bold === undefined ? d : F(k).bold ? 900 : 400);
  const deco = (k: BlockKey): CSSProperties => ({ textDecoration: F(k).underline ? "underline" : undefined, textAlign: F(k).align, fontStyle: F(k).italic === undefined ? undefined : F(k).italic ? "italic" : "normal" });
  const just = (k: BlockKey) => (F(k).align === "center" ? "center" : F(k).align === "right" ? "flex-end" : undefined);
  const hdH = sq ? 112 : 140, ftH = sq ? 112 : 148, px = sq ? 56 : 48;
  const longest = Math.max(...name.split(/\s+/).map((x) => x.length), 4); // un mot ne doit jamais être coupé : la taille du titre est plafonnée par son mot le plus long
  const title: CSSProperties = { margin: 0, fontSize: `min(${pt(sq ? 70 : 84)}, ${Math.floor((w - px * 2 - 4) / (longest * 0.7))}px)`, lineHeight: 0.98, fontWeight: wt("titre", 900), letterSpacing: "-0.02em", color: NAVY, ...deco("titre") };
  const card: CSSProperties = { border: `2px solid ${LINE}`, borderLeft: `8px solid ${acc}`, borderRadius: 14, background: "#fff", padding: `${pi(12)} ${pi(16)}`, display: "flex", alignItems: "center", gap: pi(14), minWidth: 0 };

  const dateEl = (
    <div style={{ display: "flex", justifyContent: just("date"), ...deco("date") }}><div style={{ display: "flex", borderRadius: 20, overflow: "hidden", border: `2px solid ${acc}`, maxWidth: "100%" }}>
      <div style={{ background: acc, color: "#fff", padding: `${pd(14)} ${pd(24)}`, flex: "0 0 auto" }}>
        <div style={{ fontSize: pd(sq ? 46 : 56), fontWeight: wt("date", 900), lineHeight: 1.05, whiteSpace: "nowrap" }}>{dt.big}</div>
        <div style={{ fontSize: pd(15), fontWeight: 800, letterSpacing: "0.14em", marginTop: pd(2) }}>{dt.month}</div>
      </div>
      <div style={{ padding: `${pd(12)} ${pd(22)}`, display: "flex", alignItems: "center", fontSize: pd(sq ? 20 : 23), fontWeight: wt("date", 800), lineHeight: 1.25, color: NAVY, minWidth: 0, background: "#fff" }}>{fullRange(e).replace(/^./, (c) => c.toUpperCase())}</div>
    </div></div>
  );
  const rowsEl = rows.length > 0 && (
    <div style={{ ...deco("infos"), display: "grid", gap: pi(10), gridTemplateColumns: rows.length > 1 ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)" }}>
      {rows.map((r) => (
        <div key={r.title} style={card}>
          <span aria-hidden style={{ flex: `0 0 ${pi(44)}`, width: pi(44), height: pi(44), borderRadius: 12, background: acc, display: "grid", placeItems: "center", fontSize: pi(23) }}>{r.icon}</span>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: pi(12), fontWeight: 900, letterSpacing: "0.14em", color: acc, textTransform: "uppercase" }}>{r.title}</div><div style={{ fontSize: pi(20), fontWeight: wt("infos", 800), lineHeight: 1.2, color: NAVY, overflowWrap: "break-word" }}><NoBreak text={r.text} /></div></div>
        </div>))}
    </div>
  );
  const tarifEl = formulas.length > 0 && (
    <div style={{ border: `2px solid ${NAVY}`, borderRadius: 16, overflow: "hidden", background: "#fff", ...deco("tarifs") }}>
      <div style={{ background: NAVY, color: "#fff", display: "flex", alignItems: "center", padding: `${pf(9)} ${pf(18)}`, fontSize: pf(13), fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", gap: 10 }}>
        <span style={{ flex: 1 }}>{formulas.length > 1 ? "Formules et tarifs" : "Tarif"}</span>
        {twoPrices && <><span style={{ width: pf(112), textAlign: "right" }}>Adhérent</span><span style={{ width: pf(130), textAlign: "right", whiteSpace: "nowrap" }}>Non adhérent</span></>}
      </div>
      {formulas.map((f, i) => (
        <div key={i}>
          {f.group && f.group !== (formulas[i - 1]?.group ?? "") ? <div style={{ background: `${acc}22`, color: NAVY, fontSize: pf(14), fontWeight: 900, padding: `${pf(6)} ${pf(18)}`, borderTop: i ? `1.5px solid ${LINE}` : "none" }}>{f.group}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${pf(9)} ${pf(18)}`, borderTop: `1.5px solid ${LINE}` }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: pf(19), fontWeight: wt("tarifs", 800), lineHeight: 1.2, color: NAVY }}>{f.label || "Participation"}{f.detail ? <small style={{ display: "block", fontSize: pf(13), fontWeight: 500, color: MUTED }}>{f.detail}</small> : null}</span>
            {twoPrices
              ? <><b style={{ width: pf(112), textAlign: "right", fontSize: pf(24), fontWeight: 900, color: acc }}>{f.priceMember || "—"}</b><b style={{ width: pf(130), textAlign: "right", fontSize: pf(24), fontWeight: 900, color: acc }}>{f.price || "—"}</b></>
              : <b style={{ fontSize: pf(f.price.length > 8 ? 26 : 34), fontWeight: 900, color: acc, whiteSpace: "nowrap" }}>{f.price || f.priceMember}</b>}
          </div>
        </div>))}
    </div>
  );
  const noteEl = e.note && <p style={{ margin: 0, borderLeft: `5px solid ${acc}`, paddingLeft: pn(16), fontSize: pn(19), lineHeight: 1.4, color: "#3a4256", fontStyle: "italic", fontWeight: wt("texte", 400), overflowWrap: "break-word", ...deco("texte") }}><NoBreak text={e.note} /></p>;
  const titleEl = <div><h1 style={title}>{name}</h1><div style={{ width: pt(120), height: pt(9), background: acc, borderRadius: 6, marginTop: pt(14), marginLeft: F("titre").align === "center" ? "auto" : F("titre").align === "right" ? "auto" : undefined, marginRight: F("titre").align === "center" ? "auto" : undefined }} /></div>;

  const gap = p(16);
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: "#fff", color: NAVY, fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.045, background: `repeating-linear-gradient(90deg,transparent 0 ${w / 6.6 - 2}px,${NAVY} ${w / 6.6 - 2}px ${w / 6.6}px)` }} />
      <div aria-hidden style={{ position: "absolute", right: -30, bottom: ftH - 40, fontSize: sq ? 420 : 520, lineHeight: 1, opacity: 0.07, filter: "grayscale(1)" }}>{kd.icon}</div>
      <div style={{ position: "relative", height: hdH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 16, padding: `0 ${px}px` }}>
        <span aria-hidden style={{ display: "inline-block", width: hdH - 40, height: hdH - 40, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
        <div style={{ whiteSpace: "nowrap" }}><div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.32em", color: GOLD }}>TENNIS CLUB HOUDAN</div><div style={{ fontSize: 13, opacity: 0.8, marginTop: 3 }}>Houdan · 4 courts couverts</div></div>
        <div style={{ marginLeft: "auto", background: acc, color: "#fff", borderRadius: 99, padding: "9px 18px", fontWeight: 900, fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>{kd.icon} {tour ? "Tournoi" : kd.label}</div>
      </div>
      <div style={{ position: "relative", height: 10, background: `linear-gradient(90deg,${acc},${GOLD})` }} />
      <div ref={body} style={{ position: "absolute", left: 0, right: 0, top: hdH + 10, bottom: ftH, padding: `${sq ? 26 : 34}px ${px}px ${sq ? 24 : 30}px`, ["--k" as any]: k }}>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap }}>{titleEl}{dateEl}{rowsEl}{tarifEl}{noteEl || null}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ftH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 24, padding: `0 ${px}px` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.22em", color: GOLD }}>{inscription ? "INSCRIPTIONS" : "RENSEIGNEMENTS"}</div>
          <div style={{ fontSize: Math.min(sq ? 22 : 25, Math.floor((w - px * 2 - 64 - 48 - 250) / (Math.max(longestLink(inscription), 1) * 0.62))), fontWeight: 900, lineHeight: 1.2, marginTop: 4, overflowWrap: "break-word" }}><NoBreak text={inscription || "Au club ou par e-mail"} /></div>
        </div>
        <div style={{ fontSize: 15, opacity: 0.92, textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>✉️ tennisclubhoudan@gmail.com</div>
        <span aria-hidden style={{ display: "inline-block", width: 64, height: 64, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
      </div>
    </div>
  );
}
