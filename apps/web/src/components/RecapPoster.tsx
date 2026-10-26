import { Backdrop } from "./PosterBackdrop";
import { catPlain, glue, teamParts, teamPlain } from "./posterCopy";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ClubEvent, kindOf, teamCat, titleOf, tourInfo } from "../clubPlan";
import { accentOf } from "./EventPoster";
import { NoBreak } from "./NoBreak";
import { fullRange } from "./ClubPoster";

// Affiche de BILAN d'un événement (après le tournoi, le match par équipes, l'animation) pour les réseaux sociaux : photos, résultats, déroulement.
// Tout est fabriqué dans le navigateur et RIEN n'est enregistré : les photos et les noms restent dans la fenêtre ouverte.
export type RecapFormat = "CARRE" | "PORTRAIT";
export const RECAP_SIZES: Record<RecapFormat, { w: number; h: number }> = { CARRE: { w: 1080, h: 1080 }, PORTRAIT: { w: 1080, h: 1350 } };
export interface RecapMatch { team: string; opponent: string; us: string; them: string } // team = « sen-m#1 » (catégorie + numéro d'équipe)
export interface RecapData { headline: string; photos: string[]; results: { what: string; result: string }[]; matches: RecapMatch[]; message: string }

export { teamPlain, catPlain };
// « TC Houdan bat TC Guyancourt » / « TC Houdan perd contre TC Guyancourt » / « TC Houdan fait match nul contre TC Guyancourt »
export function matchParts(m: RecapMatch): [string, string, string] { // [sujet, verbe, adversaire] : le nom d'un club ne se coupe jamais
  const a = Number(m.us), b = Number(m.them); const op = m.opponent.trim() || "leurs adversaires";
  if (m.us.trim() === "" || m.them.trim() === "" || Number.isNaN(a) || Number.isNaN(b)) return ["TC Houdan", "contre", op];
  return a > b ? ["TC Houdan", "bat", op] : a < b ? ["TC Houdan", "perd contre", op] : ["TC Houdan", "fait match nul contre", op];
}
export const matchSentence = (m: RecapMatch) => matchParts(m).join(" ");
const outcomeWord = (m: RecapMatch) => { const a = Number(m.us), b = Number(m.them); return m.us.trim() === "" || m.them.trim() === "" ? "" : a > b ? "Victoire" : a < b ? "Défaite" : "Match nul"; };
const outcomeColor = (m: RecapMatch) => { const a = Number(m.us), b = Number(m.them); return m.us.trim() === "" || m.them.trim() === "" ? "#64748b" : a > b ? "#15803d" : a < b ? "#b91c1c" : "#64748b"; };
export const emptyRecap = (): RecapData => ({ headline: "", photos: [], results: [], matches: [], message: "" });

const FONT = "Archivo, ArchivoPoster, 'Arial Narrow', system-ui, sans-serif";
const NAVY = "#1b1863", GOLD = "#f4c20d", LINE = "#e3e6ee", MUTED = "#5b6477";

// Photo choisie sur l'appareil : réduite (1000 px) et gardée en mémoire seulement
export async function photoFromFile(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choisis une photo JPEG, PNG ou WebP.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Photo illisible.")); i.src = url; });
    const k = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export function RecapPoster({ e, format, data, partners, bg = "" }: { e: ClubEvent; format: RecapFormat; data: RecapData; partners?: string[]; bg?: string }) {
  const { w, h } = RECAP_SIZES[format]; const sq = format === "CARRE";
  const kd = kindOf(e.kind); const acc = accentOf(e);
  const teamsMode = e.kind === "EQUIPES";
  const ti = tourInfo(e);
  // Tournoi : le grand titre dit le type et le public (« TMC MESSIEURS », « TOURNOI OPEN DAMES »), la ligne dessous donne les classements du TMC
  const name = (teamsMode ? "Match par équipes" : ti ? `${ti.type === "TMC" ? "TMC" : "Tournoi open"} ${ti.who}`.trim() : titleOf(e)).toUpperCase();
  const rankLine = ti && ti.bas && ti.haut ? `Classements de ${ti.bas} à ${ti.haut}` : "";
  const matches = data.matches.filter((m) => m.team || m.opponent.trim() || m.us.trim() || m.them.trim());
  const lite = !teamsMode && e.kind !== "TOURNOI"; // stages, animations, fêtes… : seulement photos et texte
  const results = lite ? [] : data.results.filter((r) => r.what.trim() || r.result.trim());
  const photos = data.photos.slice(0, 6); const logos = partners ?? [];

  // Même principe que l'affiche d'un événement : on mesure, puis on agrandit ou réduit le contenu pour remplir la place libre
  const body = useRef<HTMLDivElement>(null); const [k, setK] = useState(1);
  const sig = JSON.stringify([e, format, data.headline, data.message, results, matches, photos.length, logos.length]);
  useLayoutEffect(() => {
    const el = body.current; if (!el) return;
    const run = () => {
      const inner = el.firstElementChild as HTMLElement; if (!inner) return;
      const avail = el.clientHeight; let kk = 1; inner.style.height = "auto";
      for (let i = 0; i < 4; i++) {
        el.style.setProperty("--k", String(kk)); const hh = inner.scrollHeight; if (hh <= 0) break;
        const next = Math.max(0.5, Math.min(1.6, kk * (avail * 0.95) / hh)); if (Math.abs(next - kk) < 0.01) { kk = next; break; } kk = next;
      }
      el.style.setProperty("--k", String(kk));
      for (let i = 0; i < 12 && inner.scrollHeight > avail && kk > 0.45; i++) { kk *= 0.96; el.style.setProperty("--k", String(kk)); }
      inner.style.height = "100%"; setK(kk);
    };
    run();
    const fonts = (document as any).fonts; if (fonts?.ready) fonts.ready.then(run).catch(() => {});
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = (n: number) => `calc(${n}px * var(--k))`;
  const hdH = sq ? 100 : 112, ftH = sq ? 96 : 104, partH = logos.length ? 92 : 0, px = 56;
  const longest = Math.max(...name.split(/\s+/).map((x) => x.length), 4);
  const title: CSSProperties = { margin: 0, fontStretch: "normal", fontSize: teamsMode ? `min(${p(sq ? 66 : 76)}, ${Math.floor((w - px * 2 - 4) / (name.length * 0.68))}px)` : `min(${p(sq ? 74 : 88)}, ${Math.floor((w - px * 2 - 4) / (longest * 0.7))}px)`, lineHeight: 0.98, fontWeight: 900, letterSpacing: "-0.02em", color: NAVY };
  const card: CSSProperties = { flexShrink: 0, border: `2px solid ${LINE}`, borderLeft: `8px solid ${acc}`, borderRadius: 14, background: "#fff", padding: `${p(12)} ${p(18)}` };
  const head = (t: string) => <div style={{ fontSize: p(15), fontWeight: 900, letterSpacing: "0.16em", color: acc, marginBottom: p(8) }}>{t}</div>;

  // Photos : de 1 à 6, en mosaïque
  const cols = photos.length <= 1 ? 1 : photos.length === 2 || photos.length === 4 ? 2 : 3;
  const rows = Math.ceil(photos.length / cols);
  const grid = photos.length > 0 && (
    <div style={{ display: "grid", gap: p(8), gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, ${p((lite ? (sq ? 440 : 600) : (sq ? 330 : 420)) / rows)})`, flexShrink: 0, borderRadius: 16, overflow: "hidden" }}>
      {photos.map((src, i) => <img key={i} src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", gridColumn: photos.length === 3 && i === 0 ? "1 / span 3" : undefined }} />)}
    </div>
  );

  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: "#fff", color: NAVY, fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <Backdrop bg={bg} w={w} h={h} veil="strong" />
      <div aria-hidden style={{ position: "absolute", right: -30, bottom: ftH + partH - 40, fontSize: 420, lineHeight: 1, opacity: 0.06, filter: "grayscale(1)" }}>{kd.icon}</div>
      <div style={{ position: "relative", height: hdH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 16, padding: `0 ${px}px` }}>
        <span aria-hidden style={{ display: "inline-block", width: hdH - 36, height: hdH - 36, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
        <div style={{ whiteSpace: "nowrap" }}><div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.32em", color: GOLD }}>TENNIS CLUB HOUDAN</div></div>
        <div style={{ marginLeft: "auto", background: acc, color: "#fff", borderRadius: 99, padding: "10px 20px", fontWeight: 900, fontSize: 15, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>BILAN</div>
      </div>
      <div style={{ position: "relative", height: 10, background: `linear-gradient(90deg,${acc},${GOLD})` }} />
      <div ref={body} style={{ position: "absolute", left: 0, right: 0, top: hdH + 10, bottom: ftH + partH, padding: `${sq ? 24 : 30}px ${px}px ${sq ? 20 : 26}px`, ["--k" as any]: k }}>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: p(14) }}>
          <div>
            {data.headline.trim() && <div style={{ fontSize: p(sq ? 24 : 28), fontWeight: 900, letterSpacing: "0.18em", color: acc, marginBottom: p(6) }}>{data.headline.trim().toUpperCase()}</div>}
            <div role="heading" aria-level={1} style={title}>{name}</div>
            {rankLine && <div style={{ marginTop: p(8), fontSize: p(sq ? 30 : 34), fontWeight: 900, color: acc }}>{rankLine}</div>}
            <div style={{ marginTop: p(8), fontSize: p(sq ? 24 : 28), fontWeight: 800 }}>{fullRange(e).replace(/^./, (c) => c.toUpperCase())}</div>
          </div>
          {grid}
          {matches.length > 0 && (
            <div style={{ flexShrink: 0, display: "grid", gap: p(10) }}>
              {matches.map((m, i) => (
                <div key={i} style={{ ...card, display: "block", borderLeft: `10px solid ${outcomeColor(m)}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: p(12), marginBottom: p(6) }}>
                    <div style={{ fontWeight: 800, color: MUTED, lineHeight: 1.15 }}>{m.team ? (() => { const [c, n] = teamParts(m.team); return <><div style={{ fontSize: p(matches.length === 1 ? 28 : 24), whiteSpace: "nowrap", color: NAVY, fontWeight: 900 }}>{c}</div><div style={{ fontSize: p(matches.length === 1 ? 22 : 19) }}>{n}</div></>; })() : <div style={{ fontSize: p(22) }}>Rencontre</div>}</div>
                    {outcomeWord(m) && <div style={{ flex: "0 0 auto", background: outcomeColor(m), color: "#fff", borderRadius: 99, padding: `${p(4)} ${p(14)}`, fontSize: p(16), fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>{outcomeWord(m)}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: p(16) }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: p(matches.length === 1 ? 38 : 28), fontWeight: 900, lineHeight: 1.15, overflowWrap: "break-word" }}>{(() => { const [a, v, o] = matchParts(m); return <><span style={{ whiteSpace: "nowrap" }}>{a}</span> {v} <span style={{ whiteSpace: "nowrap" }}>{o}</span></>; })()}</div>
                    {m.us.trim() !== "" && m.them.trim() !== "" && <div style={{ flex: "0 0 auto", fontSize: p(matches.length === 1 ? 84 : 56), fontWeight: 900, lineHeight: 1, color: outcomeColor(m), whiteSpace: "nowrap" }}>{m.us.trim()}/{m.them.trim()}</div>}
                  </div>
                </div>))}
            </div>
          )}
          {results.length > 0 && (
            <div style={card}>
              {head("🏆 RÉSULTATS")}
              <div style={{ display: "grid", gap: p(6) }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: p(14), borderTop: i ? `1.5px solid ${LINE}` : "none", paddingTop: i ? p(6) : 0 }}>
                    <span style={{ flex: "0 0 36%", fontSize: p(20), fontWeight: 800, color: MUTED }}>{r.what}</span>
                    <b style={{ flex: 1, fontSize: p(24), fontWeight: 900, lineHeight: 1.15 }}><NoBreak text={r.result} /></b>
                  </div>))}
              </div>
            </div>
          )}
          {data.message.trim() && <p style={{ margin: 0, borderLeft: `6px solid ${acc}`, paddingLeft: p(18), fontSize: p(lite ? 28 : 24), lineHeight: 1.35, fontStyle: "italic", color: "#3a4256", overflowWrap: "break-word" }}><NoBreak text={glue(data.message.trim())} /></p>}
        </div>
      </div>
      {logos.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: ftH, height: partH, background: "#fff", borderTop: `3px solid ${acc}`, display: "flex", alignItems: "center", gap: 18, padding: `0 ${px}px` }}>
          <div style={{ flex: "0 0 auto", fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", color: acc, lineHeight: 1.3 }}>MERCI À<br />NOS PARTENAIRES</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-around", gap: 14, height: partH - 28 }}>
            {logos.map((l, i) => <img key={i} src={l} alt="" style={{ flex: "1 1 0", minWidth: 0, maxWidth: 170, height: "100%", objectFit: "contain" }} />)}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ftH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: `0 ${px}px` }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.04em" }}>Merci à tous !</div>
        <div style={{ fontSize: 15, opacity: 0.92, whiteSpace: "nowrap" }}>tennisclubhoudan@gmail.com</div>
        <span aria-hidden style={{ display: "inline-block", width: 60, height: 60, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
      </div>
    </div>
  );
}
