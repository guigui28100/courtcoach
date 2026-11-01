import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Backdrop } from "./PosterBackdrop";
import { SERIF } from "./posterFonts";
import { glue } from "./posterCopy";
import { NoBreak } from "./NoBreak";

// Affiche de RÉSULTATS de plusieurs tournois sur une seule page, avec des photos pour chacun.
// Tout est fabriqué dans le navigateur et RIEN n'est enregistré : les photos et les noms restent dans la fenêtre ouverte.
export type ResultsFormat = "PORTRAIT" | "CARRE" | "A4";
export const RESULTS_SIZES: Record<ResultsFormat, { w: number; h: number }> = { PORTRAIT: { w: 1080, h: 1350 }, CARRE: { w: 1080, h: 1080 }, A4: { w: 794, h: 1123 } };
export interface ResultsTournament { name: string; when: string; results: { what: string; result: string }[]; photos: string[] }
export interface ResultsData { headline: string; tournaments: ResultsTournament[]; message: string }
export const emptyTournament = (): ResultsTournament => ({ name: "", when: "", results: [], photos: [] });
export const emptyResults = (): ResultsData => ({ headline: "", tournaments: [emptyTournament()], message: "" });
export const MAX_TOURNAMENTS = 6, MAX_PHOTOS_EACH = 3, MAX_RESULT_LINES = 6;

const FONT = "Archivo, ArchivoPoster, 'Arial Narrow', system-ui, sans-serif";
const NAVY = "#17140f", GOLD = "#c9ad77", LINE = "#ddd3c0", MUTED = "#5e574a", ACC = "#8a5a1a";
const COLORS = ["#8a5a1a", "#4a6d8f", "#3f7a56", "#6f5588", "#b3261e", "#1d2f55"];

export function ResultsPoster({ format, data, partners, bg = "" }: { format: ResultsFormat; data: ResultsData; partners?: string[]; bg?: string }) {
  const { w, h } = RESULTS_SIZES[format]; const big = w > 900;
  const list = data.tournaments.map((t) => ({ ...t, results: t.results.filter((r) => r.what.trim() || r.result.trim()) })).filter((t) => t.name.trim() || t.results.length || t.photos.length);
  const logos = partners ?? [];
  const title = data.headline.trim() || "Résultats";

  // On mesure le contenu, puis on l'agrandit ou on le réduit pour remplir la place libre (comme les autres affiches)
  const body = useRef<HTMLDivElement>(null); const [k, setK] = useState(1);
  const sig = JSON.stringify([format, data, logos.length, bg]);
  useLayoutEffect(() => {
    const el = body.current; if (!el) return;
    const run = () => {
      const inner = el.firstElementChild as HTMLElement; if (!inner) return;
      const cs = getComputedStyle(el); const avail = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); let kk = 1; inner.style.height = "auto";
      for (let i = 0; i < 4; i++) {
        el.style.setProperty("--k", String(kk)); const hh = inner.scrollHeight; if (hh <= 0) break;
        const next = Math.max(0.4, Math.min(1.5, kk * (avail * 0.96) / hh)); if (Math.abs(next - kk) < 0.01) { kk = next; break; } kk = next;
      }
      el.style.setProperty("--k", String(kk));
      for (let i = 0; i < 14 && inner.scrollHeight > avail && kk > 0.35; i++) { kk *= 0.96; el.style.setProperty("--k", String(kk)); }
      inner.style.height = "100%"; setK(kk);
    };
    run();
    const fonts = (document as any).fonts; if (fonts?.ready) fonts.ready.then(run).catch(() => {});
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = (n: number) => `calc(${n}px * var(--k))`;
  const hdH = big ? 112 : 96, ftH = big ? 96 : 84, partH = logos.length ? 84 : 0, px = big ? 56 : 44;
  const titleStyle: CSSProperties = { margin: 0, fontFamily: SERIF, fontWeight: 600, lineHeight: 1, color: NAVY, fontSize: `min(${p(big ? 84 : 66)}, ${Math.floor((w - px * 2 - 4) / (Math.max(...title.split(/\s+/).map((x) => x.length), 4) * 0.5))}px)` };

  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: "#fff", color: NAVY, fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties}>
      <Backdrop bg={bg} w={w} h={h} veil="strong" />
      <div style={{ position: "relative", height: hdH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 16, padding: `0 ${px}px` }}>
        <span aria-hidden style={{ display: "inline-block", width: hdH - 34, height: hdH - 34, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
        <div style={{ whiteSpace: "nowrap", fontSize: 16, fontWeight: 900, letterSpacing: "0.32em", color: GOLD }}>TENNIS CLUB HOUDAN</div>
        <div style={{ marginLeft: "auto", background: ACC, color: "#fff", borderRadius: 99, padding: "10px 20px", fontWeight: 900, fontSize: 15, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>RÉSULTATS</div>
      </div>
      <div style={{ position: "relative", height: 10, background: `linear-gradient(90deg,${ACC},${GOLD})` }} />
      <div ref={body} style={{ position: "absolute", left: 0, right: 0, top: hdH + 10, bottom: ftH + partH, padding: `${big ? 24 : 18}px ${px}px ${big ? 20 : 14}px`, ["--k" as any]: k }}>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: p(12) }}>
          <div style={{ flexShrink: 0 }}><div role="heading" aria-level={1} style={titleStyle}>{title}</div></div>
          {list.map((t, i) => {
            const c = COLORS[i % COLORS.length]; const n = Math.min(t.photos.length, MAX_PHOTOS_EACH);
            return (
              <div key={i} style={{ flexShrink: 0, border: `2px solid ${LINE}`, borderLeft: `10px solid ${c}`, borderRadius: 14, background: "#fff", padding: `${p(12)} ${p(18)}`, display: "grid", gap: p(8) }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: p(14), flexWrap: "wrap" }}>
                  <div style={{ fontFamily: SERIF, fontSize: p(big ? 42 : 36), fontWeight: 700, lineHeight: 1.05, color: c, overflowWrap: "break-word", minWidth: 0 }}>{t.name.trim() || "Tournoi"}</div>
                  {t.when.trim() && <div style={{ fontSize: p(19), fontWeight: 800, color: MUTED, whiteSpace: "nowrap" }}>{t.when.trim()}</div>}
                </div>
                {t.results.length > 0 && (
                  <div style={{ display: "grid", gap: p(4) }}>
                    {t.results.map((r, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "baseline", gap: p(14), borderTop: j ? `1.5px solid ${LINE}` : "none", paddingTop: j ? p(4) : 0 }}>
                        <span style={{ flex: "0 0 34%", fontSize: p(19), fontWeight: 800, color: MUTED }}>{r.what}</span>
                        <b style={{ flex: 1, fontSize: p(23), fontWeight: 900, lineHeight: 1.15 }}><NoBreak text={r.result} /></b>
                      </div>))}
                  </div>
                )}
                {n > 0 && (
                  <div style={{ display: "grid", gap: p(8), gridTemplateColumns: `repeat(${n}, 1fr)`, height: p(big ? 190 : 150), borderRadius: 10, overflow: "hidden" }}>
                    {t.photos.slice(0, n).map((src, j) => <img key={j} src={src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />)}
                  </div>
                )}
              </div>);
          })}
          {data.message.trim() && <p style={{ margin: 0, flexShrink: 0, borderLeft: `6px solid ${ACC}`, paddingLeft: p(16), fontSize: p(22), lineHeight: 1.35, fontStyle: "italic", color: "#3a352c", overflowWrap: "break-word", whiteSpace: "pre-line" }}>{glue(data.message.trim())}</p>}
        </div>
      </div>
      {logos.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: ftH, height: partH, background: "#fff", borderTop: `3px solid ${ACC}`, display: "flex", alignItems: "center", gap: 18, padding: `0 ${px}px` }}>
          <div style={{ flex: "0 0 auto", fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", color: ACC, lineHeight: 1.3 }}>MERCI À<br />NOS PARTENAIRES</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-around", gap: 14, height: partH - 24 }}>
            {logos.map((l, i) => <img key={i} src={l} alt="" style={{ flex: "1 1 0", minWidth: 0, maxWidth: 160, height: "100%", objectFit: "contain" }} />)}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ftH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: `0 ${px}px` }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.04em" }}>Bravo à tous !</div>
        <div style={{ fontSize: 15, opacity: 0.92, whiteSpace: "nowrap" }}>tennisclubhoudan@gmail.com</div>
        <span aria-hidden style={{ display: "inline-block", width: 56, height: 56, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
      </div>
    </div>
  );
}
