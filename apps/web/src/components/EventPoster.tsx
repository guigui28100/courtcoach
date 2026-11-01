import { useLayoutEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { SERIF } from "./posterFonts";
import { NoBreak, longestLink } from "./NoBreak";
import { Backdrop, PosterBg } from "./PosterBackdrop";
import type { CSSProperties, ReactNode } from "react";
import { ClubEvent, DAYS, kindOf, MONTHS, titleOf, tourInfo, weekdayOf } from "../clubPlan";
import { fullRange, label } from "./ClubPoster";
import { FmtStyle, pickFmt, txt } from "./posterFmt";
import { EventPosterClassic } from "./EventPosterClassic";
import { courtsText, glue, teamParts, ledeOf, priceText, signupText, tidy } from "./posterCopy";

// Affiche d'UN événement (pour la pub auprès des adhérents) : A4 à imprimer ou carré pour WhatsApp / Facebook.
// Même finition que le dossier de saison : bandeau bleu nuit, titre géant, date en bloc d'honneur, cartes, tableau de tarifs, pied « inscriptions ».
// Tout est dessiné en HTML (aucune image extérieure) et la mise en page REMPLIT toute l'affiche : la taille du contenu s'ajuste (variable --k), le reste de la place est réparti entre les blocs.
export type PosterFormat = "A4" | "CARRE";
export const SIZES: Record<PosterFormat, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, CARRE: { w: 1080, h: 1080 } };
const FONT = "Archivo, ArchivoPoster, 'Arial Narrow', system-ui, sans-serif";
const NAVY = "#17140f", BRONZE = "#8a6a2f", GOLDL = "#b8975a", LINE = "#d8c7a5", MUTED = "#5e574a", IVORY = "#fbf8f2";
const SITE = "https://tennisclubhoudan78.jimdofree.com/"; // adresse du club écrite dans le QR code (calculé ici, rien n'est envoyé)

// Petits pictogrammes en traits fins (à la place des emojis) : un par type d'information
const PIC: Record<string, string> = {
  "🕒": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  "🏆": '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4"/>',
  "📍": '<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  "🎾": '<circle cx="12" cy="12" r="9"/><path d="M4 9c5 1 11 1 16 0M4 15c5-1 11-1 16 0"/>',
  "🎯": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  "📊": '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  "🏷️": '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  "👥": '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .8 3 3 3 6"/>',
  "🏟️": '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M12 6v12M3 12h18"/>',
  "🎒": '<path d="M7 8a5 5 0 0 1 10 0v12H7zM9 14h6M10 3h4"/>',
  "👤": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.500 8 7"/>',
};
const Pic = ({ icon, color, size }: { icon: string; color: string; size: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, flex: "none" }} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: PIC[icon] ?? PIC["📍"] }} />
);
// QR code vers le site du club : calculé dans le navigateur (aucun service extérieur), dessiné en carrés
function Qr({ text, color, size }: { text: string; color: string; size: number }) {
  const q = qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(); let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return <svg aria-label="QR code vers le site du club" role="img" viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} shapeRendering="crispEdges"><rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" /><path d={d} fill={color} /></svg>;
}

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

export type BlockKey = "titre" | "date" | "infos" | "tarifs" | "texte" | "equipe" | "numero" | "tout" | "entete" | "type" | "accroche" | "pied" | "mail" | "partenaires";
export type BlockFmt = { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; align?: "left" | "center" | "right"; color?: string; dy?: number; text?: string };
export type PosterFmt = Partial<Record<BlockKey, BlockFmt>>;

export { PHOTOS } from "./PosterBackdrop";
export type { PosterBg } from "./PosterBackdrop";

function EventPosterElegant({ e, format, showWho, fmt, partners, bg = "", light = false, onPick }: { e: ClubEvent; format: PosterFormat; showWho: boolean; fmt?: PosterFmt; partners?: string[]; bg?: PosterBg; light?: boolean; onPick?: (key: string) => void }) {
  const { w, h } = SIZES[format]; const sq = format === "CARRE";
  const kd = kindOf(e.kind); const acc = accentOf(e);
  const tiName = tourInfo(e);
  const capw = (x: string) => x.replace(/(^|\s)(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
  const name = tiName ? `${tiName.type === "TMC" ? "TMC" : "Tournoi open"} ${capw(tiName.who)}`.trim() : e.kind === "EQUIPES" && !e.title ? "Match par équipes" : titleOf(e).replace(/^\p{L}/u, (c) => c.toUpperCase()); // tournoi : le type et le public en titre, les classements dans leur carte
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
  if (e.time) rows.push({ icon: "🕒", title: tour ? "Les matchs" : "Horaires", text: e.time.includes("\n") ? e.time.split("\n").map((l) => tidy(l)).filter(Boolean).join("\n") : tidy(e.time) });
  if (e.signup && tour) rows.push({ icon: "🏆", title: "La finale", text: tidy(e.signup) });
  if (e.kind === "EQUIPES" && e.courts?.length) rows.push({ icon: "🏟️", title: "Terrains", text: courtsText(e.courts) });
  if (e.place && !tour && e.kind !== "EQUIPES") rows.push({ icon: "📍", title: "Où ?", text: tidy(e.place) });
  if (e.bring) rows.push({ icon: "🎒", title: "À prévoir", text: tidy(e.bring) });
  if (showWho && e.who.length) rows.push({ icon: "👤", title: "Avec", text: e.who.join(", ") });
  const inscription = !tour && e.signup ? signupText(e.signup) : "";
  const dt = dateBlock(e);

  // Taille du contenu : on mesure, puis on agrandit ou réduit pour remplir la place disponible (le reste est réparti entre les blocs)
  const body = useRef<HTMLDivElement>(null); const [k, setK] = useState(1);
  const g = 1 + (fmt?.tout?.size ?? 0) * 0.08; // « Tous les textes » : s'applique APRÈS l'ajustement automatique (sinon il serait annulé par lui)
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
      el.style.setProperty("--k", String(kk * g)); inner.style.height = "100%"; setK(kk);
    };
    run();
    const fonts = (document as any).fonts; if (fonts?.ready) fonts.ready.then(run).catch(() => {});
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const F = (k: BlockKey): BlockFmt => fmt?.[k] ?? {};
  const pk = (k: BlockKey) => { const f = 1 + (F(k).size ?? 0) * 0.08; return (n: number) => `calc(${n}px * var(--k) * ${f})`; };
  const [pt, pd, pi, pf, pn] = [pk("titre"), pk("date"), pk("infos"), pk("tarifs"), pk("texte")];
  const p = (n: number) => `calc(${n}px * var(--k))`;
  const wt = (k: BlockKey, d: number) => (F(k).bold === undefined ? d : F(k).bold ? 900 : 400);
  const deco = (k: BlockKey): CSSProperties => ({ textDecoration: F(k).underline ? "underline" : undefined, textAlign: F(k).align, ...(F(k).color ? { color: F(k).color } : {}), ...(F(k).dy ? { transform: `translateY(${F(k).dy! * 8}px)` } : {}), fontStyle: F(k).italic === undefined ? undefined : F(k).italic ? "italic" : "normal" });
  const just = (k: BlockKey) => (F(k).align === "center" ? "center" : F(k).align === "right" ? "flex-end" : undefined);
  const onPhoto = bg !== ""; // sur une photo : la photo reste bien visible en haut, le reste est posé sur une feuille ivoire translucide (texte lisible)
  const hdH = onPhoto ? (sq ? 210 : 340) : (sq ? 118 : 200), ftH = sq ? 150 : 190, px = sq ? 72 : 84;
  const logos = partners ?? []; const partH = logos.length ? (sq ? 92 : 104) : 0;
  const longest = Math.max(...name.split(/\s+/).map((x) => x.length), 4); // un mot ne doit jamais être coupé : la taille du titre est plafonnée par le mot le plus long
  const title: CSSProperties = { margin: 0, fontFamily: SERIF, fontSize: `min(${pt(sq ? 84 : 112)}, ${Math.floor((w - px * 2 - 4) / (longest * 0.5))}px)`, lineHeight: 0.98, fontWeight: wt("titre", 600), color: NAVY, ...deco("titre") };
  const HALO: CSSProperties = {};
  const typeLabel = tour ? (ti?.type === "TMC" ? "Tournoi multi-chances" : "Tournoi") : kd.label;
  const rule = <div aria-hidden style={{ width: p(64), height: 1.5, background: GOLDL, margin: `${pt(20)} auto` }} />;
  const SPLIT = /^(.*?)[\s\u00a0]:[\s\u00a0](.*)$/; // « Samedi 7 : de 9 h à 19 h » (l'espace avant « : » est insécable après nettoyage)
  const tableOf = (t: string) => { const ls = t.split("\n").filter(Boolean); return ls.length > 1 && ls.every((l) => SPLIT.test(l)) ? ls.map((l) => { const m = SPLIT.exec(l)!; return [m[1], m[2]] as const; }) : null; };

  const dateEl = (
    <div data-fmt="date" style={{ ...deco("date"), textAlign: F("date").align ?? "center", fontVariantNumeric: "lining-nums", ...HALO }}>
      <div style={{ fontFamily: SERIF, fontWeight: wt("date", 600), lineHeight: 1.05, whiteSpace: "nowrap", fontSize: `min(${pd(sq ? 46 : 58)}, ${Math.floor((w - px * 2 - 8) / (dt.big.length * 0.46))}px)` }}>{dt.big}</div>
      <div style={{ fontSize: pd(14), fontWeight: 800, letterSpacing: "0.3em", marginTop: pd(8), color: BRONZE }}>{dt.month}</div>
    </div>
  );
  const rowsEl = rows.length > 0 && (
    <div data-fmt="infos" style={{ ...deco("infos"), display: "grid", gap: pi(22), gridTemplateColumns: "minmax(0,1fr)", textAlign: F("infos").align ?? "left" }}>
      {rows.map((r) => { const tb = tableOf(r.text); return (
        <div key={r.title} style={{ minWidth: 0, gridColumn: tb ? "1 / -1" : undefined, ...HALO }}>
          <div style={{ display: "flex", alignItems: "center", gap: pi(10), fontSize: pi(12), fontWeight: 800, letterSpacing: "0.2em", color: BRONZE, textTransform: "uppercase", borderBottom: `1px solid ${GOLDL}`, paddingBottom: pi(7) }}><Pic icon={r.icon} color={BRONZE} size={pi(24)} />{r.title}</div>
          {tb
            ? tb.map(([a, b], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: pi(16), borderBottom: `1px solid ${LINE}`, padding: `${pi(9)} 0`, fontSize: pi(21), color: NAVY }}><span>{a}</span><b style={{ fontWeight: wt("infos", 800), whiteSpace: "nowrap" }}>{b}</b></div>)
            : <div style={{ marginTop: pi(9), fontSize: pi(22), fontWeight: wt("infos", 600), lineHeight: 1.25, color: NAVY, overflowWrap: "break-word", whiteSpace: "pre-line", textWrap: "balance" as any }}><NoBreak text={r.text} /></div>}
        </div>); })}
    </div>
  );
  const tarifEl = formulas.length > 0 && (
    <div data-fmt="tarifs" style={{ ...deco("tarifs"), ...HALO }}>
      <div style={{ display: "flex", alignItems: "center", paddingBottom: pf(8), borderBottom: `1px solid ${GOLDL}`, fontSize: pf(12), fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: BRONZE, gap: 10 }}>
        <span style={{ flex: 1 }}>{formulas.length > 1 ? "Formules et tarifs" : "Tarif"}</span>
        {twoPrices && <><span style={{ width: pf(112), textAlign: "right" }}>Adhérent</span><span style={{ width: pf(130), textAlign: "right", whiteSpace: "nowrap" }}>Non adhérent</span></>}
      </div>
      {formulas.map((f, i) => (
        <div key={i}>
          {f.group && f.group !== (formulas[i - 1]?.group ?? "") ? <div style={{ color: BRONZE, fontFamily: SERIF, fontStyle: "italic", fontSize: pf(20), fontWeight: 600, padding: `${pf(8)} 0 ${pf(2)}` }}>{tidy(f.group)}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${pf(9)} 0`, borderBottom: `1px solid ${LINE}` }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: pf(20), fontWeight: wt("tarifs", 600), lineHeight: 1.2, color: NAVY }}>{tidy(f.label) || "Participation"}{f.detail ? <small style={{ display: "block", fontSize: pf(13), fontWeight: 400, color: MUTED }}>{tidy(f.detail)}</small> : null}</span>
            {twoPrices
              ? <><b style={{ width: pf(112), textAlign: "right", fontFamily: SERIF, fontSize: pf(30), fontWeight: 600, color: BRONZE }}>{priceText(f.priceMember) || "—"}</b><b style={{ width: pf(130), textAlign: "right", fontFamily: SERIF, fontSize: pf(30), fontWeight: 600, color: BRONZE }}>{priceText(f.price) || "—"}</b></>
              : <b style={{ fontFamily: SERIF, fontSize: pf(priceText(f.price).length > 8 ? 30 : 40), fontWeight: 600, color: BRONZE, whiteSpace: "nowrap" }}>{priceText(f.price) || priceText(f.priceMember)}</b>}
          </div>
        </div>))}
    </div>
  );
  const noteText = txt(fmt, "texte", e.note ?? "");
  const noteEl = noteText && <p data-fmt="texte" style={{ margin: 0, textAlign: F("texte").align ?? "center", fontFamily: SERIF, ...HALO, fontSize: pn(25), lineHeight: 1.35, color: onPhoto ? NAVY : "#3a352c", fontStyle: "italic", fontWeight: wt("texte", 500), overflowWrap: "break-word", whiteSpace: "pre-line", textWrap: "pretty" as any, ...deco("texte") }}><NoBreak text={glue(noteText)} /></p>;
  const teamsEl = e.kind === "EQUIPES" && e.teams.length > 0 && (
    <div style={{ display: "grid", gap: pt(10), margin: `${pt(16)} 0 0` }}>
      {e.teams.map((t) => { const [cat, num] = teamParts(t); return (
        <div key={t}>
          <div data-fmt="equipe" style={{ whiteSpace: "nowrap", fontWeight: wt("equipe", 700), lineHeight: 1.05, color: NAVY, fontSize: `min(${pk("equipe")(sq ? 40 : 46)}, ${Math.floor((w - px * 2) / (cat.length * 0.6))}px)`, ...deco("equipe") }}>{cat}</div>
          <div data-fmt="numero" style={{ fontFamily: SERIF, fontWeight: wt("numero", 600), lineHeight: 1.05, color: BRONZE, fontSize: pk("numero")(sq ? 56 : 66), marginTop: pt(4), ...deco("numero") }}>{num}</div>
        </div>); })}
    </div>
  );
  const glow: CSSProperties = {};
  const titleEl = <div style={{ ...glow, textAlign: F("titre").align ?? "center" }}><div data-fmt="type" style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: pt(sq ? 28 : 34), color: BRONZE, marginBottom: pt(8) }}>{txt(fmt, "type", typeLabel)}</div><h1 data-fmt="titre" style={title}>{txt(fmt, "titre", name).replace(/ · /g, "\u00a0· ")}</h1>{teamsEl}{txt(fmt, "accroche", lede.text) && <p data-fmt="accroche" style={{ margin: `${pt(16)} 0 0`, fontSize: pt(sq ? 22 : 24), lineHeight: 1.35, fontWeight: 500, letterSpacing: "0.02em", color: "#3a352c", overflowWrap: "break-word", textWrap: "balance" as any, ...deco("accroche") }}>{txt(fmt, "accroche", lede.text).split("\n").map((l, i) => i === 0 && lede.text.includes("\n") && fmt?.accroche?.text === undefined ? <b key={i} style={{ display: "block", color: NAVY, fontWeight: 800 }}>{l}</b> : <span key={i} style={{ display: "block" }}>{l}</span>)}</p>}</div>;

  const gap = p(18);
  const qrSize = sq ? 104 : 120;
  return (
    <div onClick={(ev) => pickFmt(ev, onPick)} style={{ position: "relative", width: w, height: h, overflow: "hidden", background: IVORY, color: NAVY, fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <FmtStyle fmts={fmt} noZoom={["titre", "date", "infos", "tarifs", "texte", "equipe", "numero"]} />
      <Backdrop bg={bg} w={w} h={h} veil="light" pos="center 72%" />
      {onPhoto && <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: 0, height: hdH, background: "linear-gradient(180deg,rgba(15,12,8,.6),rgba(15,12,8,.05))" }} />}
      {onPhoto && <div aria-hidden style={{ position: "absolute", left: 24, right: 24, top: hdH, bottom: 24, background: `rgba(251,248,242,${light ? 0.74 : 0.93})`, borderTop: `1.5px solid ${GOLDL}` }} />}
      <div aria-hidden style={{ position: "absolute", inset: 24, border: `1.5px solid ${GOLDL}`, pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", inset: 32, border: `0.5px solid ${GOLDL}`, pointerEvents: "none" }} />
      <div style={{ position: "relative", height: hdH, display: "flex", flexDirection: sq ? "row" : "column", alignItems: "center", justifyContent: onPhoto && !sq ? "flex-start" : "center", gap: sq ? 22 : 12, paddingTop: sq ? 16 : 28 }}>
        <span aria-hidden style={{ display: "inline-block", width: sq ? 74 : 96, height: sq ? 74 : 96, background: onPhoto ? "#fff" : NAVY, filter: onPhoto ? "drop-shadow(0 2px 6px rgba(0,0,0,.55))" : undefined, WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
        <div style={{ whiteSpace: "nowrap" }}><div data-fmt="entete" style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.4em", color: onPhoto ? "#fff" : NAVY, textShadow: onPhoto ? "0 2px 8px rgba(0,0,0,.7)" : undefined, ...HALO }}>{txt(fmt, "entete", "TENNIS CLUB HOUDAN")}</div></div>
      </div>
      <div ref={body} style={{ position: "absolute", left: 0, right: 0, top: hdH, bottom: ftH + partH, padding: `${sq ? 14 : 22}px ${px}px ${sq ? 18 : 24}px`, ["--k" as any]: k * g }}>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: light ? "center" : "space-evenly", gap: light ? p(26) : gap }}>{[titleEl, dateEl, rowsEl, tarifEl, noteEl || null].map((c, i) => (c ? <div key={i} style={{ flexShrink: 0 }}>{i === 0 ? <>{c}{rule}</> : c}</div> : null))}</div>
      </div>
      {logos.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: ftH, height: partH, borderTop: `1px solid ${GOLDL}`, display: "flex", alignItems: "center", gap: 18, padding: `0 ${px}px`, background: "rgba(251,248,242,.9)" }}>
          <div data-fmt="partenaires" style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", color: BRONZE, lineHeight: 1.3 }}>NOS<br />PARTENAIRES</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-around", gap: 14, height: partH - 28 }}>
            {logos.map((l, i) => <img key={i} src={l} alt="" style={{ flex: "1 1 0", minWidth: 0, maxWidth: 170, height: "100%", objectFit: "contain" }} />)}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: px, right: px, bottom: 40, height: ftH - 56, borderTop: `1.5px solid ${GOLDL}`, display: "flex", alignItems: "center", gap: 24, ...HALO }}>
        <div data-fmt="pied" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.22em", color: BRONZE }}>{inscription ? "INSCRIPTIONS" : "RENSEIGNEMENTS"}</div>
          <div style={{ fontSize: Math.min(sq ? 21 : 23, Math.floor((w - px * 2 - qrSize - 48) / (Math.max(longestLink(inscription), 1) * 0.62))), fontWeight: 700, lineHeight: 1.25, marginTop: 5, overflowWrap: "break-word" }}><NoBreak text={inscription || "Au club ou par e-mail"} /></div>
          <div data-fmt="mail" style={{ fontSize: 15, marginTop: 6, color: MUTED, whiteSpace: "nowrap" }}>{txt(fmt, "mail", "✉️ tennisclubhoudan@gmail.com")}</div>
        </div>
        <div style={{ flex: "none", border: `1px solid ${GOLDL}`, lineHeight: 0 }}><Qr text={SITE} color={NAVY} size={qrSize - 8} /></div>
      </div>
    </div>
  );
}

// Deux dispositions au choix : « elegant » (ivoire, filets dorés, QR code) ou « classique » (l'ancienne : bandeau bleu nuit, cartes)
export type PosterLayout = "elegant" | "classique";
export function EventPoster(p: { e: ClubEvent; format: PosterFormat; showWho: boolean; fmt?: PosterFmt; partners?: string[]; bg?: PosterBg; light?: boolean; onPick?: (key: string) => void; layout?: PosterLayout }) {
  const { layout = "elegant", ...rest } = p;
  return layout === "classique" ? <EventPosterClassic {...rest} /> : <EventPosterElegant {...rest} />;
}
