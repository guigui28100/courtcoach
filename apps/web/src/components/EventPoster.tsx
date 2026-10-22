import { useLayoutEffect, useRef, useState } from "react";
import { ClubEvent, kindOf, titleOf } from "../clubPlan";
import { fullRange, label } from "./ClubPoster";

// Affiche d'UN événement (pour la pub auprès des adhérents) : A4 à imprimer ou carré pour WhatsApp / Facebook. Tout est dessiné en HTML (aucune image extérieure) et chaque type d'événement a son ambiance.
export type PosterFormat = "A4" | "CARRE";
export const SIZES: Record<PosterFormat, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, CARRE: { w: 1080, h: 1080 } };
const FONT = "Archivo, ArchivoPoster, 'Arial Narrow', system-ui, sans-serif";

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`; };

type Deco = "court" | "confetti" | "waves" | "lines";
const DECO: Record<string, Deco> = { TOURNOI: "court", EQUIPES: "court", ANIMATION: "confetti", FETE: "confetti", FETE_ECOLE: "confetti", STAGE_ENFANTS: "waves", STAGE_ADULTES: "waves" };
const ambiance = (kind: string) => { const c1 = kindOf(kind).color; return { c1, c2: mix(c1, "#000000", 0.4), bg: mix(c1, "#ffffff", 0.93), soft: mix(c1, "#ffffff", 0.86), acc: "#e3f24b", deco: DECO[kind] ?? "lines" as Deco }; };

function Decor({ deco, w, h }: { deco: Deco; w: number; h: number }) {
  const common = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
  if (deco === "court") return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ ...common, opacity: 0.22 }} fill="none" stroke="#fff" strokeWidth="3">
      <rect x="40" y="40" width={w - 80} height={h - 80} /><line x1={w / 2} y1="40" x2={w / 2} y2={h - 40} /><line x1={w * 0.2} y1="40" x2={w * 0.2} y2={h - 40} /><line x1={w * 0.8} y1="40" x2={w * 0.8} y2={h - 40} /><line x1={w * 0.2} y1={h / 2} x2={w * 0.8} y2={h / 2} />
    </svg>);
  if (deco === "confetti") return (
    <svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" style={common}>
      <g fill="#fff" opacity=".35"><circle cx="90" cy="80" r="10" /><circle cx="300" cy="40" r="6" /><circle cx="520" cy="110" r="12" /><circle cx="700" cy="300" r="9" /><circle cx="420" cy="330" r="8" /><circle cx="60" cy="300" r="6" /><circle cx="250" cy="250" r="7" /></g>
      <g fill="#ffd23f" opacity=".75"><path d="M200 120l8 18 19 2-14 13 4 19-17-10-17 10 4-19-14-13 19-2z" /><path d="M560 260l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z" /><path d="M360 300l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" /></g>
    </svg>);
  if (deco === "waves") return (
    <svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" style={common}>
      <g fill="#fff" opacity=".25"><circle cx="110" cy="90" r="40" /><circle cx="520" cy="60" r="22" /><circle cx="690" cy="320" r="46" /><circle cx="400" cy="120" r="12" /></g>
      <g fill="none" stroke="#fff" strokeWidth="5" opacity=".35"><path d="M0 300q100-60 200 0t200 0t200 0t200 0" /><path d="M0 340q100-60 200 0t200 0t200 0t200 0" /></g>
    </svg>);
  return (
    <svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="none" style={{ ...common, opacity: 0.18 }} fill="none" stroke="#fff" strokeWidth="3"><path d="M0 300L800 120M0 360L800 180M0 240L800 60" /></svg>);
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
  const k = kindOf(e.kind); const a = ambiance(e.kind);
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
  if (e.audience) rows.push({ icon: "👥", title: "POUR QUI", text: e.audience });
  if (e.time) rows.push({ icon: "🕒", title: "HORAIRES", text: e.time });
  if (e.place) rows.push({ icon: "📍", title: "LIEU", text: e.place });
  if (e.bring) rows.push({ icon: "🎒", title: "À PRÉVOIR", text: e.bring });
  if (e.signup) rows.push({ icon: "✍️", title: "INSCRIPTIONS", text: e.signup });
  if (showWho && e.who.length) rows.push({ icon: "👤", title: "AVEC", text: e.who.join(", ") });
  const twoCol = sq && rows.length > 1 && rows.every((r) => r.text.length <= 26);
  const rowW = (twoCol ? (w - px * 2 - 12) / 2 : w - px * 2) - 120; // place pour le texte à côté de l'icône
  const card = { background: "#fff", border: `3px solid ${a.c1}`, borderRadius: 18, boxShadow: "0 5px 12px rgba(27,24,99,.12)" } as const;
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: a.bg, color: "#1b1863", fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, letterSpacing: "normal", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", textAlign: "left" }}>
      <div style={{ position: "relative", height: hd, background: `linear-gradient(135deg,${a.c1} 0%,${a.c2} 100%)`, color: "#fff", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)" }}>
        <Decor deco={a.deco} w={w} h={hd} />
        <span aria-hidden style={{ position: "absolute", left: px - 8, top: 20, width: logoSize, height: logoSize, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", filter: "drop-shadow(0 3px 5px rgba(0,0,0,.3))" }} />
        <div style={{ position: "absolute", left: px + logoSize, top: 20 + logoSize / 2 - 10, fontSize: 15, fontWeight: 800, letterSpacing: "0.3em", opacity: 0.95, whiteSpace: "nowrap" }}>TENNIS CLUB HOUDAN</div>
        <div style={{ position: "absolute", left: px, right: px, top: Math.max(26 + medal, 20 + logoSize) + 10, fontSize: fs, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 4px 0 rgba(0,0,0,.15)" }}>{name}</div>
        <div aria-hidden style={{ position: "absolute", right: px, top: 26, width: medal, height: medal, borderRadius: "50%", background: a.acc, border: "6px solid #fff", display: "grid", placeItems: "center", fontSize: medal * 0.5, boxShadow: "0 10px 24px rgba(0,0,0,.28)" }}>{k.icon}</div>
        <div style={{ position: "absolute", left: px, bottom: dense ? 30 : 44, background: "#fff", color: a.c2, borderRadius: 18, padding: "10px 22px", fontWeight: 900, fontSize: dateFs, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(0,0,0,.25)" }}>{dateTxt}</div>
      </div>
      <Fit top={hd + 4} bottom={sq ? 100 : 112} h={h} w={w}>
        <div style={{ padding: `22px ${px}px 0`, display: "grid", gap: 12 }}>
          {rows.length > 0 && (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr" }}>
              {rows.map((r) => (
                <div key={r.title} style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: "10px 18px" }}>
                  <span aria-hidden style={{ flex: "0 0 48px", width: 48, height: 48, borderRadius: 14, background: a.c1, color: "#fff", display: "grid", placeItems: "center", fontSize: 26 }}>{r.icon}</span>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", color: "#6b6557" }}>{r.title}</div><div style={{ fontSize: fit(r.text, rowW, 25, 13), fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap" }}>{r.text}</div></div>
                </div>))}
            </div>)}
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
          {e.note && <div style={{ background: a.soft, borderLeft: `10px solid ${a.c1}`, borderRadius: 16, padding: "14px 20px", fontSize: 22, lineHeight: 1.35, color: "#2b2a42", overflowWrap: "anywhere" }}>{e.note}</div>}
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
