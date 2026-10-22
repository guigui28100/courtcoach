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

// Fond commun à TOUS les événements : terre battue texturée (dégradé + grain + stries), lignes de court blanches ; la couleur du type ne sert qu'aux accents (icônes, médaillon, bandes)
function ClayBackground({ w, h }: { w: number; h: number }) {
  const common = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={common}>
      <defs>
        <linearGradient id="clay-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9622f" /><stop offset="1" stopColor="#8f3115" /></linearGradient>
        <filter id="clay-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed="9" /><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .05  0 0 0 0 0  0 0 0 .55 0" /></filter>
        <filter id="clay-brush" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".04 .5" numOctaves="2" seed="3" /><feColorMatrix values="0 0 0 0 1  0 0 0 0 .85  0 0 0 0 .7  0 0 0 .22 0" /></filter>
      </defs>
      <rect width={w} height={h} fill="url(#clay-g)" />
      <rect width={w} height={h} filter="url(#clay-brush)" />
      <rect width={w} height={h} filter="url(#clay-grain)" opacity=".7" />
      <g stroke="#fff" strokeWidth={Math.round(w / 150)} fill="none" opacity=".55" strokeLinecap="round">
        <path d={`M${-w * 0.02} ${h * 0.52}L${w * 1.02} ${h * 0.4}`} />
        <path d={`M${w * 0.5} ${h * 0.34}L${w * 0.44} ${h}`} />
      </g>
    </svg>);
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
  const k = kindOf(e.kind); const a = ambiance(e.kind, e.audience);
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
  const card = { background: "#fff", border: `3px solid ${a.c1}`, borderRadius: 18, boxShadow: "0 8px 18px rgba(60,15,0,.38)" } as const;
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
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: "#b8471f", color: "#1b1863", fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, letterSpacing: "normal", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", textAlign: "left" }}>
      <ClayBackground w={w} h={h} />
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
