import { useLayoutEffect, useRef, useState } from "react";
import { NoBreak, longestLink } from "./NoBreak";
import { Backdrop, PosterBg } from "./PosterBackdrop";
import type { CSSProperties, ReactNode } from "react";
import { ClubEvent, DAYS, kindOf, MONTHS, titleOf, tourInfo, weekdayOf } from "../clubPlan";
import { fullRange, label } from "./ClubPoster";
import { courtsText, glue, teamParts, ledeOf, priceText, signupText, tidy } from "./posterCopy";

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
export const accentOf = (e: ClubEvent) => (e.kind === "TOURNOI" ? TOURNOI_COLOR[tourBase(e.audience ?? "")] : undefined) ?? kindOf(e.kind).color;

const MON3 = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function dateBlock(e: ClubEvent) {
  const [a, b] = [e.startDate, e.endDate]; const d = (x: string) => +x.slice(8, 10); const m = (x: string) => +x.slice(5, 7) - 1;
  const month = a.slice(0, 7) === b.slice(0, 7) ? `${MONTHS[m(a)]} ${a.slice(0, 4)}` : `${MONTHS[m(a)]} → ${MONTHS[m(b)]} ${b.slice(0, 4)}`;
  // La date n'est écrite qu'UNE fois : un seul jour = « DIMANCHE 22 » ; une période = « 16 → 20 » + « Du lundi au vendredi » (les jours de la semaine)
  const low = (s: string) => s.toLowerCase();
  if (a === b) return { big: `${DAYS[weekdayOf(a)].toUpperCase()} ${d(a)}`, month: month.toUpperCase(), side: "" };
  // Une période s'écrit « Du lundi 7 au vendredi 10 » (avec le mois sous le texte) ; si elle change de mois : « Du lundi 28 oct. au vendredi 1 nov. »
  const same = a.slice(0, 7) === b.slice(0, 7);
  const part = (x: string) => `${low(DAYS[weekdayOf(x)])} ${d(x)}${same ? "" : ` ${MON3[m(x)]}`}`;
  return { big: `Du ${part(a)} au ${part(b)}`, month: month.toUpperCase(), side: "" };
}

type Row = { icon: string; title: string; text: string };

export type BlockKey = "titre" | "date" | "infos" | "tarifs" | "texte";
export type BlockFmt = { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; align?: "left" | "center" | "right" };
export type PosterFmt = Partial<Record<BlockKey, BlockFmt>>;

export { PHOTOS } from "./PosterBackdrop";
export type { PosterBg } from "./PosterBackdrop";

export function EventPoster({ e, format, showWho, fmt, partners, bg = "", light = false }: { e: ClubEvent; format: PosterFormat; showWho: boolean; fmt?: PosterFmt; partners?: string[]; bg?: PosterBg; light?: boolean }) {
  const { w, h } = SIZES[format]; const sq = format === "CARRE";
  const kd = kindOf(e.kind); const acc = accentOf(e);
  const tiName = tourInfo(e);
  const name = (tiName ? `${tiName.type === "TMC" ? "TMC" : "Tournoi open"} ${tiName.who}`.trim() : e.kind === "EQUIPES" && !e.title ? "Match par équipes" : titleOf(e)).toUpperCase(); // tournoi : le type et le public en titre, les classements dans leur carte
  const formulas = (e.formulas ?? []).filter((f) => f.label || f.price || f.priceMember);
  const twoPrices = formulas.some((f) => f.priceMember && f.price);
  const tour = e.kind === "TOURNOI"; // tournoi : lieu = surface, horaires = matchs jour par jour, inscriptions = finale
  // Le texte est REFORMULÉ (posterCopy) : une phrase d'accroche sous le titre, puis seulement les cartes qui apportent une information de plus
  const lede = ledeOf(e);
  const rows: Row[] = [];
  const ti = tourInfo(e);
  if (ti && !lede.covers.type) rows.push({ icon: ti.type === "TMC" ? "🎯" : "🏆", title: "Type de tournoi", text: ti.type === "TMC" ? "TMC (tournoi multi-chances)" : "Tournoi open" });
  if (ti?.bas && ti?.haut && !lede.text.replace(/\u00a0/g, " ").includes(`${ti.bas} à ${ti.haut}`)) rows.push({ icon: "📊", title: "Classements acceptés", text: `de ${ti.bas} à ${ti.haut}` });
  if (e.audience && e.kind !== "EQUIPES" && !lede.covers.audience) rows.push({ icon: tour ? "🏷️" : "👥", title: tour && TOURNOI_COLOR[tourBase(e.audience)] ? "Catégorie" : "Pour qui ?", text: tidy(e.audience.replace(" · ", " – ")) });
  if (e.place && tour && !lede.covers.surface) rows.push({ icon: "🎾", title: "Surface", text: tidy(e.place) });
  if (e.time) rows.push({ icon: "🕒", title: tour ? "Les matchs" : "Horaires", text: tidy(e.time) });
  if (e.signup && tour) rows.push({ icon: "🏆", title: "La finale", text: tidy(e.signup) });
  if (e.kind === "EQUIPES" && e.courts?.length) rows.push({ icon: "🏟️", title: "Terrains", text: courtsText(e.courts) });
  if (e.place && !tour && e.kind !== "EQUIPES") rows.push({ icon: "📍", title: "Où ?", text: tidy(e.place) });
  if (e.bring) rows.push({ icon: "🎒", title: "À prévoir", text: tidy(e.bring) });
  if (showWho && e.who.length) rows.push({ icon: "👤", title: "Avec", text: e.who.join(", ") });
  const inscription = !tour && e.signup ? signupText(e.signup) : "";
  const dt = dateBlock(e);

  // Taille du contenu : on mesure, puis on agrandit ou réduit pour remplir la place disponible (le reste est réparti entre les blocs)
  const body = useRef<HTMLDivElement>(null); const [k, setK] = useState(1);
  const sig = JSON.stringify([e, format, showWho, fmt, (partners ?? []).length, light, bg]);
  useLayoutEffect(() => {
    const el = body.current; if (!el) return;
    const run = () => {
      const inner = el.firstElementChild as HTMLElement; if (!inner) return;
      const cs = getComputedStyle(el); const avail = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); let kk = 1; inner.style.height = "auto";
      for (let i = 0; i < 4; i++) {
        el.style.setProperty("--k", String(kk)); const hh = inner.scrollHeight;
        if (hh <= 0) break; const next = Math.max(0.55, Math.min(1.5, kk * (avail * 0.9) / hh)); if (Math.abs(next - kk) < 0.01) { kk = next; break; } kk = next;
      }
      if (light) kk = Math.max(0.5, kk * 0.85); // « cartes réduites » (contenu groupé et centré, mêmes proportions) : le contenu rétrécit et laisse voir le fond
      el.style.setProperty("--k", String(kk));
      for (let i = 0; i < 10 && inner.scrollHeight > avail && kk > 0.5; i++) { kk *= 0.96; el.style.setProperty("--k", String(kk)); }
      inner.style.height = "100%"; setK(kk);
    };
    run();
    const fonts = (document as any).fonts; if (fonts?.ready) fonts.ready.then(run).catch(() => {});
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const F = (k: BlockKey): BlockFmt => fmt?.[k] ?? {};
  const pk = (k: BlockKey) => { const f = 1 + (F(k).size ?? 0) * 0.08; return (n: number) => `calc(${n}px * var(--k) * ${f})`; };
  const [pt, pd, pi, pf, pn] = [pk("titre"), pk("date"), pk("infos"), pk("tarifs"), pk("texte")];
  const p = (n: number) => `calc(${n}px * var(--k))`;
  const wt = (k: BlockKey, d: number) => (F(k).bold === undefined ? d : F(k).bold ? 900 : 400);
  const deco = (k: BlockKey): CSSProperties => ({ textDecoration: F(k).underline ? "underline" : undefined, textAlign: F(k).align, fontStyle: F(k).italic === undefined ? undefined : F(k).italic ? "italic" : "normal" });
  const just = (k: BlockKey) => (F(k).align === "center" ? "center" : F(k).align === "right" ? "flex-end" : undefined);
  const hdH = sq ? 112 : 140, ftH = sq ? 112 : 148, px = sq ? 56 : 48;
  const logos = partners ?? []; const partH = logos.length ? (sq ? 92 : 104) : 0;
  const longest = Math.max(...name.split(/\s+/).map((x) => x.length), 4); // un mot ne doit jamais être coupé : la taille du titre est plafonnée par son mot le plus long
  const title: CSSProperties = { margin: 0, fontSize: `min(${pt(sq ? 70 : 84)}, ${Math.floor((w - px * 2 - 4) / (longest * 0.7))}px)`, lineHeight: 0.98, fontWeight: wt("titre", 900), letterSpacing: "-0.02em", color: NAVY, ...deco("titre") };
  const onPhoto = bg !== ""; // sur une photo : cartes transparentes, texte entouré d'un halo blanc pour rester lisible
  const HALO: CSSProperties = onPhoto ? { textShadow: "0 0 6px rgba(255,255,255,1), 0 0 14px rgba(255,255,255,.95), 0 0 26px rgba(255,255,255,.8)" } : {};
  const card: CSSProperties = { border: `2px solid ${onPhoto ? "rgba(255,255,255,.55)" : LINE}`, borderLeft: `8px solid ${acc}`, borderRadius: 14, background: onPhoto ? "rgba(255,255,255,.22)" : "#fff", ...HALO, padding: `${pi(12)} ${pi(16)}`, display: "flex", alignItems: "center", gap: pi(14), minWidth: 0 };

  const dateEl = (
    <div style={{ display: "flex", justifyContent: just("date"), ...deco("date") }}><div style={{ display: "flex", borderRadius: 20, overflow: "hidden", border: `2px solid ${acc}`, maxWidth: "100%" }}>
      <div style={{ background: acc, color: "#fff", padding: `${pd(14)} ${pd(24)}`, flex: "0 0 auto" }}>
        <div style={{ fontSize: `min(${pd(sq ? 46 : 56)}, ${Math.floor((w - px * 2 - 76 - 10) / (dt.big.length * 0.56))}px)`, fontWeight: wt("date", 900), lineHeight: 1.05, whiteSpace: "nowrap" }}>{dt.big}</div>
        <div style={{ fontSize: pd(15), fontWeight: 800, letterSpacing: "0.14em", marginTop: pd(2) }}>{dt.month}</div>
      </div>
      {dt.side && <div style={{ padding: `${pd(12)} ${pd(22)}`, display: "flex", alignItems: "center", fontSize: pd(sq ? 20 : 23), fontWeight: wt("date", 800), lineHeight: 1.25, color: NAVY, minWidth: 0, background: onPhoto ? "rgba(255,255,255,.22)" : "#fff", ...HALO, textWrap: "pretty" as any }}>{dt.side}</div>}
    </div></div>
  );
  const rowsEl = rows.length > 0 && (
    <div style={{ ...deco("infos"), display: "grid", gap: pi(10), gridTemplateColumns: rows.length > 1 ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)" }}>
      {rows.map((r) => (
        <div key={r.title} style={card}>
          <span aria-hidden style={{ flex: `0 0 ${pi(44)}`, width: pi(44), height: pi(44), borderRadius: 12, background: acc, display: "grid", placeItems: "center", fontSize: pi(23) }}>{r.icon}</span>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: pi(12), fontWeight: 900, letterSpacing: "0.14em", color: acc, textTransform: "uppercase" }}>{r.title}</div><div style={{ fontSize: pi(20), fontWeight: wt("infos", 800), lineHeight: 1.2, color: NAVY, overflowWrap: "break-word", textWrap: "balance" as any }}><NoBreak text={r.text} /></div></div>
        </div>))}
    </div>
  );
  const tarifEl = formulas.length > 0 && (
    <div style={{ border: `2px solid ${NAVY}`, borderRadius: 16, overflow: "hidden", background: onPhoto ? "rgba(255,255,255,.22)" : "#fff", ...HALO, ...deco("tarifs") }}>
      <div style={{ background: NAVY, color: "#fff", display: "flex", alignItems: "center", padding: `${pf(9)} ${pf(18)}`, fontSize: pf(13), fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", gap: 10 }}>
        <span style={{ flex: 1 }}>{formulas.length > 1 ? "Formules et tarifs" : "Tarif"}</span>
        {twoPrices && <><span style={{ width: pf(112), textAlign: "right" }}>Adhérent</span><span style={{ width: pf(130), textAlign: "right", whiteSpace: "nowrap" }}>Non adhérent</span></>}
      </div>
      {formulas.map((f, i) => (
        <div key={i}>
          {f.group && f.group !== (formulas[i - 1]?.group ?? "") ? <div style={{ background: `${acc}22`, color: NAVY, fontSize: pf(14), fontWeight: 900, padding: `${pf(6)} ${pf(18)}`, borderTop: i ? `1.5px solid ${LINE}` : "none" }}>{tidy(f.group)}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${pf(9)} ${pf(18)}`, borderTop: `1.5px solid ${LINE}` }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: pf(19), fontWeight: wt("tarifs", 800), lineHeight: 1.2, color: NAVY }}>{tidy(f.label) || "Participation"}{f.detail ? <small style={{ display: "block", fontSize: pf(13), fontWeight: 500, color: MUTED }}>{tidy(f.detail)}</small> : null}</span>
            {twoPrices
              ? <><b style={{ width: pf(112), textAlign: "right", fontSize: pf(24), fontWeight: 900, color: acc }}>{priceText(f.priceMember) || "—"}</b><b style={{ width: pf(130), textAlign: "right", fontSize: pf(24), fontWeight: 900, color: acc }}>{priceText(f.price) || "—"}</b></>
              : <b style={{ fontSize: pf(priceText(f.price).length > 8 ? 26 : 34), fontWeight: 900, color: acc, whiteSpace: "nowrap" }}>{priceText(f.price) || priceText(f.priceMember)}</b>}
          </div>
        </div>))}
    </div>
  );
  const noteEl = e.note && <p style={{ margin: 0, borderLeft: `5px solid ${acc}`, paddingLeft: pn(16), ...HALO, fontSize: pn(19), lineHeight: 1.4, color: onPhoto ? NAVY : "#3a4256", fontStyle: "italic", fontWeight: wt("texte", 400), overflowWrap: "break-word", textWrap: "pretty" as any, ...deco("texte") }}><NoBreak text={glue(e.note)} /></p>;
  const teamsEl = e.kind === "EQUIPES" && e.teams.length > 0 && (
    <div style={{ display: "grid", gap: pt(10), margin: `${pt(16)} 0 0`, ...deco("titre") }}>
      {e.teams.map((t) => { const [cat, num] = teamParts(t); return (
        <div key={t}>
          <div style={{ whiteSpace: "nowrap", fontWeight: 900, lineHeight: 1.05, color: NAVY, fontSize: `min(${pt(sq ? 40 : 46)}, ${Math.floor((w - px * 2) / (cat.length * 0.6))}px)` }}>{cat}</div>
          <div style={{ fontWeight: 800, lineHeight: 1.1, color: acc, fontSize: pt(sq ? 28 : 32), marginTop: pt(2) }}>{num}</div>
        </div>); })}
    </div>
  );
  const glow: CSSProperties = bg !== "" ? { textShadow: "0 0 10px rgba(255,255,255,.95), 0 0 22px rgba(255,255,255,.9), 0 1px 2px rgba(255,255,255,.9)" } : {}; // pas de carte : un halo blanc fait ressortir le texte posé directement sur le fond
  const titleEl = <div style={glow}><h1 style={title}>{name.replace(/ · /g, "\u00a0· ")}</h1><div style={{ width: pt(120), height: pt(9), background: acc, borderRadius: 6, marginTop: pt(14), marginLeft: F("titre").align === "center" ? "auto" : F("titre").align === "right" ? "auto" : undefined, marginRight: F("titre").align === "center" ? "auto" : undefined }} />{teamsEl}{lede.text && <p style={{ margin: `${pt(14)} 0 0`, fontSize: pt(sq ? 24 : 27), lineHeight: 1.3, fontWeight: 600, color: "#3a4256", overflowWrap: "break-word", textWrap: "balance" as any, ...deco("titre") }}>{lede.text.split("\n").map((l, i) => i === 0 && lede.text.includes("\n") ? <b key={i} style={{ display: "block", color: NAVY, fontWeight: 900 }}>{l}</b> : <span key={i} style={{ display: "block" }}>{l}</span>)}</p>}</div>;

  const gap = p(16);
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: "#fff", color: NAVY, fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <Backdrop bg={bg} w={w} h={h} veil={light ? "light" : "normal"} />
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.045, background: `repeating-linear-gradient(90deg,transparent 0 ${w / 6.6 - 2}px,${NAVY} ${w / 6.6 - 2}px ${w / 6.6}px)` }} />
      <div aria-hidden style={{ position: "absolute", right: -30, bottom: ftH - 40, fontSize: sq ? 420 : 520, lineHeight: 1, opacity: 0.07, filter: "grayscale(1)" }}>{kd.icon}</div>
      <div style={{ position: "relative", height: hdH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 16, padding: `0 ${px}px` }}>
        <span aria-hidden style={{ display: "inline-block", width: hdH - 40, height: hdH - 40, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
        <div style={{ whiteSpace: "nowrap" }}><div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.32em", color: GOLD }}>TENNIS CLUB HOUDAN</div></div>
        <div style={{ marginLeft: "auto", background: acc, color: "#fff", borderRadius: 99, padding: "9px 18px", fontWeight: 900, fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>{kd.icon} {tour ? "Tournoi" : kd.label}</div>
      </div>
      <div style={{ position: "relative", height: 10, background: `linear-gradient(90deg,${acc},${GOLD})` }} />
      <div ref={body} style={{ position: "absolute", left: 0, right: 0, top: hdH + 10, bottom: ftH + partH, padding: `${sq ? 26 : 34}px ${px}px ${sq ? 24 : 30}px`, ["--k" as any]: k }}>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: light ? "center" : "space-evenly", gap: light ? p(26) : gap }}>{[titleEl, dateEl, rowsEl, tarifEl, noteEl || null].map((c, i) => (c ? <div key={i} style={{ flexShrink: 0 }}>{c}</div> : null))}</div>
      </div>
      {logos.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: ftH, height: partH, background: "#fff", borderTop: `3px solid ${acc}`, display: "flex", alignItems: "center", gap: 18, padding: `0 ${px}px` }}>
          <div style={{ flex: "0 0 auto", fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", color: acc, lineHeight: 1.3 }}>NOS<br />PARTENAIRES</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-around", gap: 14, height: partH - 28 }}>
            {logos.map((l, i) => <img key={i} src={l} alt="" style={{ flex: "1 1 0", minWidth: 0, maxWidth: 170, height: "100%", objectFit: "contain" }} />)}
          </div>
        </div>
      )}
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
