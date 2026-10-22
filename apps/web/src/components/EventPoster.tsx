import { useLayoutEffect, useRef, useState } from "react";
import { ClubEvent, kindOf, titleOf } from "../clubPlan";
import { fullRange, label } from "./ClubPoster";

// Affiche d'UN événement (pour la pub auprès des adhérents) : A4 à imprimer ou carré pour WhatsApp / Facebook. Tout est dessiné en HTML (aucune image extérieure) et chaque type d'événement a son ambiance.
export type PosterFormat = "A4" | "CARRE";
export const SIZES: Record<PosterFormat, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, CARRE: { w: 1080, h: 1080 } };
const FONT = "Archivo, ArchivoPoster, 'Arial Narrow', system-ui, sans-serif";

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`; };

type Deco = "court" | "confetti" | "waves" | "lines" | "ribbons";
const DECO: Record<string, Deco> = { TOURNOI: "court", EQUIPES: "court", ANIMATION: "confetti", FETE: "confetti", FETE_ECOLE: "confetti", STAGE_ENFANTS: "waves", STAGE_ADULTES: "waves" };
// Tournoi : TROIS présentations (choisies par la catégorie) : messieurs adultes (bleu marine, lignes de court), dames adultes (framboise, rubans), jeunes (vert vif, confettis)
export const TOURNOI_STYLES: Record<string, { c1: string; acc: string; deco: Deco; icon: string; bg: string }> = {
  "Messieurs (adultes)": { c1: "#1e3a8a", acc: "#e3f24b", deco: "court", icon: "🏆", bg: "#eef2fb" },
  "Dames (adultes)": { c1: "#be185d", acc: "#fde68a", deco: "ribbons", icon: "🏆", bg: "#fdf0f6" },
  "Jeunes": { c1: "#15a34a", acc: "#ffd23f", deco: "confetti", icon: "🎾", bg: "#effaf2" },
};
const ambiance = (kind: string, audience = "") => { const t = kind === "TOURNOI" ? TOURNOI_STYLES[audience] : undefined; const c1 = t?.c1 ?? kindOf(kind).color; return { c1, c2: mix(c1, "#000000", 0.4), bg: t?.bg ?? mix(c1, "#ffffff", 0.93), soft: mix(c1, "#ffffff", 0.86), acc: t?.acc ?? "#e3f24b", deco: t?.deco ?? DECO[kind] ?? "lines" as Deco, icon: t?.icon }; };

// Six fonds d'affiche, un par « famille » d'événement (choisis par le coach sur maquettes) : terre battue, nuit néon, aurore, géométrique, élégant, trame pop.
export type Look = "clay" | "neon" | "aurore" | "geo" | "elegant" | "pop";
const LOOK_OF_KIND: Record<string, Look> = { TOURNOI: "clay", EQUIPES: "clay", ANIMATION: "aurore", FETE: "aurore", FETE_ECOLE: "geo", STAGE_ENFANTS: "pop", STAGE_ADULTES: "neon", INSCRIPTIONS: "elegant" };
const LOOK_OF_CATEGORY: Record<string, Look> = { "Messieurs (adultes)": "neon", "Dames (adultes)": "elegant", "Jeunes": "geo" }; // tournoi : une présentation par catégorie
export const lookOf = (kind: string, audience = ""): Look => (kind === "TOURNOI" ? LOOK_OF_CATEGORY[audience] : undefined) ?? LOOK_OF_KIND[kind] ?? "clay";
const BORDER: Record<Look, string> = { clay: "", neon: "#d7ff3a", aurore: "#ffffff", geo: "#14213d", elegant: "#c9ad63", pop: "#ffffff" };
const SHADOW: Record<Look, string> = { clay: "0 8px 18px rgba(60,15,0,.38)", neon: "0 8px 22px rgba(0,0,0,.5)", aurore: "0 10px 26px rgba(60,10,90,.32)", geo: "5px 6px 0 rgba(20,33,61,.9)", elegant: "0 6px 16px rgba(60,45,10,.2)", pop: "0 8px 18px rgba(0,60,60,.35)" };

function PosterBackground({ look, w, h, hd }: { look: Look; w: number; h: number; hd: number }) {
  const common = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
  const sw = Math.max(2, Math.round(w / 150));
  const defs: Record<Look, React.ReactNode> = {
    clay: (<>
      <linearGradient id="clay-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9622f" /><stop offset="1" stopColor="#8f3115" /></linearGradient>
      <filter id="clay-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed="9" /><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .05  0 0 0 0 0  0 0 0 .55 0" /></filter>
      <filter id="clay-brush" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".04 .5" numOctaves="2" seed="3" /><feColorMatrix values="0 0 0 0 1  0 0 0 0 .85  0 0 0 0 .7  0 0 0 .22 0" /></filter></>),
    neon: (<>
      <radialGradient id="ne-a" cx="15%" cy="8%" r="65%"><stop offset="0" stopColor="#5b3cff" stopOpacity=".9" /><stop offset="1" stopColor="#5b3cff" stopOpacity="0" /></radialGradient>
      <radialGradient id="ne-b" cx="95%" cy="30%" r="60%"><stop offset="0" stopColor="#00e0a4" stopOpacity=".6" /><stop offset="1" stopColor="#00e0a4" stopOpacity="0" /></radialGradient>
      <linearGradient id="ne-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d7ff3a" stopOpacity="0" /><stop offset="1" stopColor="#d7ff3a" stopOpacity=".5" /></linearGradient></>),
    aurore: (<>
      <radialGradient id="au-a" cx="8%" cy="0%" r="80%"><stop offset="0" stopColor="#ff7a45" /><stop offset="1" stopColor="#ff7a45" stopOpacity="0" /></radialGradient>
      <radialGradient id="au-b" cx="100%" cy="28%" r="75%"><stop offset="0" stopColor="#c026d3" /><stop offset="1" stopColor="#c026d3" stopOpacity="0" /></radialGradient>
      <radialGradient id="au-c" cx="40%" cy="100%" r="85%"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></radialGradient>
      <filter id="au-grain" x="0" y="0" width="100%" height="100%"><feTurbulence baseFrequency=".9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0" /></filter></>),
    geo: null, elegant: (<linearGradient id="el-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8903a" /><stop offset=".5" stopColor="#e9d08a" /><stop offset="1" stopColor="#a9822f" /></linearGradient>),
    pop: (<>
      <pattern id="po-d" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="11" cy="11" r="5" fill="#fff" /></pattern>
      <radialGradient id="po-m" cx="88%" cy="10%" r="95%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      <mask id="po-k"><rect width={w} height={h} fill="url(#po-m)" /></mask></>),
  };
  const body: Record<Look, React.ReactNode> = {
    clay: (<>
      <rect width={w} height={h} fill="url(#clay-g)" /><rect width={w} height={h} filter="url(#clay-brush)" /><rect width={w} height={h} filter="url(#clay-grain)" opacity=".7" />
      <g stroke="#fff" strokeWidth={sw} fill="none" opacity=".55" strokeLinecap="round"><path d={`M${-w * 0.02} ${h * 0.52}L${w * 1.02} ${h * 0.4}`} /><path d={`M${w * 0.5} ${h * 0.34}L${w * 0.44} ${h}`} /></g></>),
    neon: (<>
      <rect width={w} height={h} fill="#0b0f2a" /><rect width={w} height={h} fill="url(#ne-a)" /><rect width={w} height={h} fill="url(#ne-b)" />
      <rect y={h * 0.45} width={w} height={h * 0.55} fill="url(#ne-c)" opacity=".4" />
      <g stroke="#d7ff3a" strokeWidth={sw * 0.7} fill="none" opacity=".7"><path d={`M${w * 0.15} ${h}L${w * 0.38} ${h * 0.46}M${w * 0.85} ${h}L${w * 0.62} ${h * 0.46}M${-w * 0.02} ${h}L${w * 0.27} ${h * 0.46}M${w * 1.02} ${h}L${w * 0.73} ${h * 0.46}M${w * 0.5} ${h}V${h * 0.46}`} /><path d={`M${w * 0.29} ${h * 0.52}H${w * 0.71}M${w * 0.23} ${h * 0.64}H${w * 0.77}M${w * 0.15} ${h * 0.8}H${w * 0.85}`} /></g></>),
    aurore: (<>
      <rect width={w} height={h} fill="#fff0e3" /><rect width={w} height={h} fill="url(#au-a)" /><rect width={w} height={h} fill="url(#au-b)" opacity=".85" /><rect width={w} height={h} fill="url(#au-c)" opacity=".9" /><rect width={w} height={h} filter="url(#au-grain)" />
      <circle cx={w * 0.2} cy={h * 0.78} r={w * 0.2} fill="none" stroke="#fff" strokeWidth={sw * 0.6} opacity=".5" /><circle cx={w * 0.2} cy={h * 0.78} r={w * 0.12} fill="#fff" opacity=".18" /></>),
    geo: (<>
      <rect width={w} height={h} fill="#f4efe6" /><rect width={w} height={hd} fill="#14213d" />
      <circle cx={w * 0.9} cy={hd * 0.08} r={w * 0.17} fill="#e63946" opacity=".92" /><path d={`M${w} ${hd} L${w} ${hd - w * 0.16} A${w * 0.16} ${w * 0.16} 0 0 0 ${w * 0.84} ${hd}Z`} fill="#ffd23f" opacity=".95" />
      <rect y={hd} width={w} height={h * 0.015} fill="#2a9d8f" />
      <path d={`M${w} ${h} L${w} ${h * 0.7} A${w * 0.3} ${w * 0.3} 0 0 0 ${w * 0.7} ${h}Z`} fill="#2a9d8f" /><path d={`M${w} ${h} L${w} ${h * 0.82} A${w * 0.18} ${w * 0.18} 0 0 0 ${w * 0.82} ${h}Z`} fill="#ffd23f" /></>),
    elegant: (<>
      <rect width={w} height={h} fill="#f7f1e3" /><rect width={w} height={hd} fill="#1f3a2e" />
      <rect x="0" y={hd - 5} width={w} height="5" fill="url(#el-g)" />
      <rect x={w * 0.03} y={w * 0.03} width={w * 0.94} height={h - w * 0.06} fill="none" stroke="url(#el-g)" strokeWidth={sw * 0.8} /><rect x={w * 0.045} y={w * 0.045} width={w * 0.91} height={h - w * 0.09} fill="none" stroke="url(#el-g)" strokeWidth={sw * 0.3} /></>),
    pop: (<>
      <rect width={w} height={h} fill="#0ea5a4" /><rect width={w} height={h} fill="url(#po-d)" mask="url(#po-k)" opacity=".5" />
      <path d={`M0 ${hd * 0.95}L${w} ${hd * 0.62}V${h}H0Z`} fill="#fde047" /><path d={`M0 ${hd * 1.05}L${w} ${hd * 0.72}V${h}H0Z`} fill="#ff5d73" /></>),
  };
  return (<svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={common}><defs>{defs[look]}</defs>{body[look]}</svg>);
}

// Si le contenu est trop long pour la place, il est rétréci pour ne jamais toucher le pied de page
function Fit({ top, bottom, h, w, children }: { top: number; bottom: number; h: number; w: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sc, setSc] = useState(1);
  useLayoutEffect(() => {
    const calc = () => { const avail = h - top - bottom; const ch = ref.current?.offsetHeight ?? 0; const n = ch > avail ? avail / ch : 1; setSc((p) => (Math.abs(p - n) < 0.001 ? p : n)); };
    calc();
    const ro = typeof ResizeObserver !== "undefined" && ref.current ? new ResizeObserver(calc) : null; // le texte peut changer de taille quand la police est chargée
    ro?.observe(ref.current!); document.fonts?.ready.then(calc).catch(() => {});
    return () => ro?.disconnect();
  });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, height: h - top - bottom, overflow: "hidden" }}>
      <div ref={ref} style={{ width: w, transform: `scale(${sc})`, transformOrigin: "top center" }}>{children}</div>
    </div>
  );
}

export function EventPoster({ e, format, showWho }: { e: ClubEvent; format: PosterFormat; showWho: boolean }) {
  const { w, h } = SIZES[format]; const sq = format === "CARRE";
  const k = kindOf(e.kind); const a = ambiance(e.kind, e.audience); const look = lookOf(e.kind, e.audience);
  const name = (e.kind === "EQUIPES" && !e.title ? label(e) : titleOf(e)).toUpperCase();
  const formulas = (e.formulas ?? []).filter((f) => f.label || f.price || f.priceMember);
  const twoPrices = formulas.some((f) => f.priceMember && f.price);
  const infoCount = [e.audience, e.time, e.place, e.bring, e.signup].filter(Boolean).length;
  const dense = infoCount + formulas.length * 1.4 > (sq ? 11 : 9); // beaucoup de contenu : bandeau du haut plus bas pour laisser la place
  const px = sq ? 64 : 56; const hd = dense ? (sq ? 330 : 290) : sq ? 400 : 390; const medal = dense ? 100 : sq ? 150 : 130; const logoSize = dense ? 110 : 140;
  // Tout le texte important tient sur UNE SEULE LIGNE : la taille s'ajuste à la longueur et à la place disponible
  const fit = (text: string, width: number, max: number, min = 14, k = 0.55) => Math.max(min, Math.min(max, width / (Math.max(text.length, 1) * k)));
  const fs = fit(name, w - px * 2, (sq ? 110 : 96) * (dense ? 0.85 : 1), 30, 0.8);
  const dateTxt = fullRange(e); const dateFs = fit(dateTxt, w - px * 2 - 48, dense ? 26 : sq ? 34 : 30, 16, 0.56);
  const rows: { icon: string; title: string; text: string }[] = [];
  const tour = e.kind === "TOURNOI"; // tournoi : lieu = surface, horaires = matchs jour par jour, inscriptions = finale
  if (e.audience) rows.push({ icon: tour ? "🏷️" : "👥", title: tour && TOURNOI_STYLES[e.audience] ? "CATÉGORIE" : "POUR QUI", text: e.audience });
  if (e.place && tour) rows.push({ icon: "🎾", title: "SURFACE", text: e.place });
  if (e.time) rows.push({ icon: "🕒", title: tour ? "MATCHS, JOUR PAR JOUR" : "HORAIRES", text: e.time });
  if (e.signup && tour) rows.push({ icon: "🏆", title: "FINALE", text: e.signup });
  if (e.place && !tour) rows.push({ icon: "📍", title: "LIEU", text: e.place });
  if (e.bring) rows.push({ icon: "🎒", title: "À PRÉVOIR", text: e.bring });
  if (e.signup && !tour) rows.push({ icon: "✍️", title: "INSCRIPTIONS", text: e.signup });
  if (showWho && e.who.length) rows.push({ icon: "👤", title: "AVEC", text: e.who.join(", ") });
  const twoCol = sq && rows.length > 1 && rows.every((r) => r.text.length <= 26);
  const rowW = (twoCol ? (w - px * 2 - 12) / 2 : w - px * 2) - 120; // place pour le texte à côté de l'icône
  const card = { background: "#fff", border: `3px solid ${BORDER[look] || a.c1}`, borderRadius: 18, boxShadow: SHADOW[look] } as const;
  const anim = e.kind === "ANIMATION"; // animation : description, horaires, tarif, puis où s'inscrire
  const rowsBlock = (list: typeof rows) => list.length > 0 && (

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr" }}>
              {list.map((r) => (
                <div key={r.title} style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: (tour || anim) ? "18px 22px" : "10px 18px" }}>
                  <span aria-hidden style={{ flex: "0 0 48px", width: 48, height: 48, borderRadius: 14, background: a.c1, color: "#fff", display: "grid", placeItems: "center", fontSize: 26 }}>{r.icon}</span>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", color: "#6b6557" }}>{r.title}</div><div style={{ fontSize: fit(r.text, rowW, (tour || anim) ? 32 : 25, 13), fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap" }}>{r.text}</div></div>
                </div>))}
            </div>
  );
  const noteBlock = e.note && <div style={{ background: a.soft, borderLeft: `10px solid ${a.c1}`, borderRadius: 16, padding: "14px 20px", fontSize: 22, lineHeight: 1.35, color: "#2b2a42", overflowWrap: "anywhere" }}>{e.note}</div>;
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: look === "geo" ? "#f4efe6" : look === "elegant" ? "#f7f1e3" : "#b8471f", color: "#1b1863", fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, letterSpacing: "normal", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", textAlign: "left" }}>
      <PosterBackground look={look} w={w} h={h} hd={hd} />
      <div style={{ position: "relative", height: hd, color: "#fff" }}>
        <span aria-hidden style={{ position: "absolute", left: px - 8, top: 20, width: logoSize, height: logoSize, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", filter: "drop-shadow(0 3px 5px rgba(0,0,0,.3))" }} />
        <div style={{ position: "absolute", left: px + logoSize, top: 20 + logoSize / 2 - 10, fontSize: 15, fontWeight: 800, letterSpacing: "0.3em", opacity: 0.95, whiteSpace: "nowrap" }}>TENNIS CLUB HOUDAN</div>
        <div style={{ position: "absolute", left: px, right: px, top: Math.max(26 + medal, 20 + logoSize) + 10, fontSize: fs, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 4px 0 rgba(0,0,0,.25)" }}>{name}</div>
        <div aria-hidden style={{ position: "absolute", right: px, top: 26, width: medal, height: medal, borderRadius: "50%", background: a.acc, border: "6px solid #fff", display: "grid", placeItems: "center", fontSize: medal * 0.5, boxShadow: "0 10px 24px rgba(0,0,0,.28)" }}>{a.icon ?? k.icon}</div>
        <div style={{ position: "absolute", left: px, bottom: dense ? 30 : 44, background: "#fff", color: a.c2, borderRadius: 18, padding: "10px 22px", fontWeight: 900, fontSize: dateFs, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(0,0,0,.25)" }}>{dateTxt}</div>
      </div>
      <Fit top={hd + 4} bottom={sq ? 100 : 112} h={h} w={w}>
        <div style={{ padding: `22px ${px}px 0`, display: "grid", gap: 12 }}>
          {anim && noteBlock}
          {rowsBlock(anim ? rows.filter((r) => r.title !== "INSCRIPTIONS") : rows)}
          {formulas.length > 0 && (
            <div style={{ ...card, padding: "12px 20px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 900, letterSpacing: "0.16em", color: a.c2, marginBottom: 6 }}><span aria-hidden style={{ fontSize: 22 }}>💶</span>{formulas.length > 1 ? "NOS FORMULES" : "TARIF"}
                {twoPrices && <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 13 }}><span style={{ width: 120, textAlign: "right", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>ADHÉRENT</span><span style={{ width: 120, textAlign: "right", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>NON ADHÉRENT</span></span>}
              </div>
              {formulas.map((f, i) => (
                <div key={i}>
                  {(f.group ?? "") !== (formulas[i - 1]?.group ?? "") && f.group ? <div style={{ marginTop: i ? 10 : 2, padding: "6px 12px", background: a.c1, color: "#fff", borderRadius: 10, fontSize: fit(f.group, w - px * 2 - 64, 16, 11, 0.58), fontWeight: 900, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{f.group}</div> : null}
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", borderTop: i && !((f.group ?? "") !== (formulas[i - 1]?.group ?? "") && f.group) ? `2px dotted ${mix(a.c1, "#ffffff", 0.6)}` : "none" }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 800, whiteSpace: "nowrap", fontSize: fit(f.label, w - px * 2 - 40 - (twoPrices ? 240 : f.price.length * 22) - 40, 25, 13) }}>{f.label}{f.detail ? <span style={{ display: "block", fontSize: fit(f.detail, w - px * 2 - 40 - (twoPrices ? 240 : f.price.length * 22) - 40, 16, 11, 0.5), fontWeight: 600, color: "#6b6557", marginTop: 2 }}>{f.detail}</span> : null}</span>
                  {twoPrices ? [f.priceMember, f.price].map((p, k) => <span key={k} style={{ flex: "0 0 120px", textAlign: "right", fontSize: fit(p || "—", 120, 30, 16, 0.6), fontWeight: 900, color: a.c2, whiteSpace: "nowrap" }}>{p || "—"}</span>) : <span style={{ flex: "0 0 auto", fontSize: 32, fontWeight: 900, color: a.c2, whiteSpace: "nowrap" }}>{f.priceMember ? `Adhérent ${f.priceMember}` : f.price}</span>}
                </div>
                </div>))}
            </div>)}
          {anim && rowsBlock(rows.filter((r) => r.title === "INSCRIPTIONS"))}
          {!anim && noteBlock}
        </div>
      </Fit>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: sq ? 88 : 96, background: "#1b1863", color: "#fff", padding: `0 ${px}px`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap" }}>
          <span aria-hidden style={{ display: "inline-block", width: 56, height: 56, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
          <div><div style={{ fontWeight: 900, fontSize: 21, letterSpacing: "0.03em" }}>Tennis Club Houdan</div>{!sq && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>4 courts couverts · terre battue et dur</div>}</div>
        </div>
        <div style={{ fontSize: sq ? 20 : 17, fontWeight: 800, color: "#ffe45c", whiteSpace: "nowrap" }}>✉️ tennisclubhoudan@gmail.com</div>
      </div>
    </div>
  );
}
