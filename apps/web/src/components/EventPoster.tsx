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
    const avail = h - top - bottom; const ch = ref.current?.offsetHeight ?? 0;
    const n = ch > avail ? avail / ch : 1;
    setSc((p) => (Math.abs(p - n) < 0.001 ? p : n));
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
  const px = sq ? 64 : 56; const hd = sq ? 400 : 390;
  // Taille du titre : le plus long mot doit tenir sur une ligne dans la place à gauche du médaillon
  const gap = sq ? 310 : 270; const avail = w - px - gap; const longest = Math.max(...name.split(/\s+/).map((x) => x.length), 1);
  const base = name.length <= 12 ? 100 : name.length <= 20 ? 78 : name.length <= 30 ? 62 : 50;
  const fs = Math.max(38, Math.min(base * (sq ? 1.05 : 1), avail / (longest * 0.82)));
  const formulas = (e.formulas ?? []).filter((f) => f.label || f.price);
  const rows: { icon: string; title: string; text: string }[] = [];
  if (e.audience) rows.push({ icon: "👥", title: "POUR QUI", text: e.audience });
  if (e.time) rows.push({ icon: "🕒", title: "HORAIRES", text: e.time });
  if (e.place) rows.push({ icon: "📍", title: "LIEU", text: e.place });
  if (e.bring) rows.push({ icon: "🎒", title: "À PRÉVOIR", text: e.bring });
  if (e.signup) rows.push({ icon: "✍️", title: "INSCRIPTIONS", text: e.signup });
  if (showWho && e.who.length) rows.push({ icon: "👤", title: "AVEC", text: e.who.join(", ") });
  const card = { background: "#fff", border: `3px solid ${a.c1}`, borderRadius: 18, boxShadow: "0 5px 12px rgba(27,24,99,.12)" } as const;
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: a.bg, color: "#1b1863", fontFamily: FONT, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", textAlign: "left" }}>
      <div style={{ position: "relative", height: hd, background: `linear-gradient(135deg,${a.c1} 0%,${a.c2} 100%)`, color: "#fff", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)" }}>
        <Decor deco={a.deco} w={w} h={hd} />
        <div style={{ position: "absolute", left: px, top: 44, right: gap }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.3em", opacity: 0.95 }}>TENNIS CLUB HOUDAN</div>
          <div style={{ fontSize: fs, fontWeight: 900, lineHeight: 1, marginTop: 14, textShadow: "0 4px 0 rgba(0,0,0,.15)" }}>{name}</div>
        </div>
        <div aria-hidden style={{ position: "absolute", right: sq ? 56 : 48, top: 40, width: sq ? 210 : 190, height: sq ? 210 : 190, borderRadius: "50%", background: a.acc, border: "6px solid #fff", display: "grid", placeItems: "center", fontSize: sq ? 104 : 94, boxShadow: "0 10px 24px rgba(0,0,0,.28)" }}>{k.icon}</div>
        <div style={{ position: "absolute", left: px, bottom: 44, background: "#fff", color: a.c2, borderRadius: 18, padding: "10px 22px", fontWeight: 900, fontSize: sq ? 34 : 30, boxShadow: "0 8px 18px rgba(0,0,0,.25)", maxWidth: w - px * 2 }}>{fullRange(e)}</div>
      </div>
      <Fit top={hd + 4} bottom={sq ? 100 : 112} h={h} w={w}>
        <div style={{ padding: `22px ${px}px 0`, display: "grid", gap: 12 }}>
          {rows.length > 0 && (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: sq && rows.length > 1 ? "1fr 1fr" : "1fr" }}>
              {rows.map((r) => (
                <div key={r.title} style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: "10px 18px" }}>
                  <span aria-hidden style={{ flex: "0 0 48px", width: 48, height: 48, borderRadius: 14, background: a.c1, color: "#fff", display: "grid", placeItems: "center", fontSize: 26 }}>{r.icon}</span>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", color: "#6b6557" }}>{r.title}</div><div style={{ fontSize: sq ? 24 : 25, fontWeight: 800, lineHeight: 1.2, overflowWrap: "anywhere" }}>{r.text}</div></div>
                </div>))}
            </div>)}
          {formulas.length > 0 && (
            <div style={{ ...card, padding: "12px 20px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 900, letterSpacing: "0.16em", color: a.c2, marginBottom: 6 }}><span aria-hidden style={{ fontSize: 22 }}>💶</span>{formulas.length > 1 ? "NOS FORMULES" : "TARIF"}</div>
              {formulas.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", borderTop: i ? `2px dotted ${mix(a.c1, "#ffffff", 0.6)}` : "none" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 25, fontWeight: 800, overflowWrap: "anywhere" }}>{f.label}{f.detail ? <span style={{ display: "block", fontSize: 16, fontWeight: 600, color: "#6b6557", marginTop: 2 }}>{f.detail}</span> : null}</span>
                  <span style={{ flex: "0 0 auto", fontSize: 32, fontWeight: 900, color: a.c2, whiteSpace: "nowrap" }}>{f.price}</span>
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
