import { Backdrop } from "./PosterBackdrop";
import { Fmts, FmtStyle, pickFmt, txt } from "./posterFmt";
import { SERIF } from "./posterFonts";
import { catPlain, glue, teamParts, teamPlain } from "./posterCopy";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ClubEvent, fmtDay, kindOf, teamCat, titleOf, tourInfo } from "../clubPlan";
import { accentOf } from "./EventPoster";
import { NoBreak } from "./NoBreak";
import { fullRange } from "./ClubPoster";

// Affiche de BILAN d'un événement (après le tournoi, le match par équipes, l'animation) pour les réseaux sociaux : photos, résultats, déroulement.
// Tout est fabriqué dans le navigateur et RIEN n'est enregistré : les photos et les noms restent dans la fenêtre ouverte.
export type RecapFormat = "CARRE" | "PORTRAIT";
export const RECAP_SIZES: Record<RecapFormat, { w: number; h: number }> = { CARRE: { w: 1080, h: 1080 }, PORTRAIT: { w: 1080, h: 1350 } };
export interface RecapMatch { team: string; opponent: string; us: string; them: string; photo?: string; focus?: [number, number]; zoom?: number; size?: number; date?: string } // zoom : photo agrandie DANS son cadre (1 à 3) ; size : taille du cadre (0,6 à 1,6) // team = « sen-m#1 » (catégorie + numéro d'équipe)
export interface RecapData { headline: string; photos: string[]; focus?: [number, number][]; zoom?: number[]; results: { what: string; result: string }[]; matches: RecapMatch[]; message: string }

export { teamPlain, catPlain };
// « TC Houdan bat TC Guyancourt » / « TC Houdan perd contre TC Guyancourt » / « TC Houdan fait match nul contre TC Guyancourt »
export function matchParts(m: RecapMatch): [string, string, string] { // [sujet, verbe, adversaire] : le nom d'un club ne se coupe jamais
  const a = Number(m.us), b = Number(m.them); const op = m.opponent.trim() || "leurs adversaires";
  if (m.us.trim() === "" || m.them.trim() === "" || Number.isNaN(a) || Number.isNaN(b)) return ["TC Houdan", "contre", op];
  return a > b ? ["TC Houdan", "bat", op] : a < b ? ["TC Houdan", "perd contre", op] : ["TC Houdan", "fait match nul contre", op];
}
export const matchSentence = (m: RecapMatch) => matchParts(m).join(" ");
const outcomeWord = (m: RecapMatch) => { const a = Number(m.us), b = Number(m.them); return m.us.trim() === "" || m.them.trim() === "" ? "" : a > b ? "Victoire" : a < b ? "Défaite" : "Match nul"; };
const outcomeColor = (m: RecapMatch) => { const a = Number(m.us), b = Number(m.them); return m.us.trim() === "" || m.them.trim() === "" ? "#5e574a" : a > b ? "#15803d" : a < b ? "#b91c1c" : "#5e574a"; };
export const emptyRecap = (): RecapData => ({ headline: "", photos: [], results: [], matches: [], message: "" });

const FONT = "Archivo, ArchivoPoster, 'Arial Narrow', system-ui, sans-serif";
const NAVY = "#17140f", GOLD = "#c9ad77", LINE = "#ddd3c0", MUTED = "#5e574a";

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

// Photos par rangée selon leur nombre : la taille de chaque photo s'adapte (1 grande, 2 côte à côte, 3 = 1 + 2, 5 = 2 + 3…)
export const PHOTO_ROWS: Record<number, number[]> = { 1: [1], 2: [2], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [3, 4], 8: [4, 4] };

export function RecapPoster({ e, format, data, partners, bg = "", fmt, onPick, onPan, onPanMatch }: { e: ClubEvent; format: RecapFormat; data: RecapData; partners?: string[]; bg?: string; fmt?: Fmts; onPick?: (key: string) => void; onPan?: (i: number, x: number, y: number) => void; onPanMatch?: (i: number, x: number, y: number) => void }) {
  const { w, h } = RECAP_SIZES[format]; const sq = format === "CARRE";
  const kd = kindOf(e.kind); const acc = accentOf(e);
  const teamsMode = e.kind === "EQUIPES";
  const ti = tourInfo(e);
  // Tournoi : le grand titre dit le type et le public (« TMC MESSIEURS », « TOURNOI OPEN DAMES »), la ligne dessous donne les classements du TMC
  const name = (teamsMode ? "Match par équipes" : ti ? `${ti.type === "TMC" ? "TMC" : "Tournoi open"} ${ti.who}`.trim() : titleOf(e)).toUpperCase();
  const rankLine = ti && ti.bas && ti.haut ? `Classements de ${ti.bas} à ${ti.haut}` : "";
  const matches = data.matches.map((m, i) => ({ m, i })).filter(({ m }) => m.team || m.opponent.trim() || m.us.trim() || m.them.trim()); // i = place d'origine : les réglages de texte restent attachés à la bonne rencontre
  const lite = !teamsMode && e.kind !== "TOURNOI"; // stages, animations, fêtes… : seulement photos et texte
  const results = lite ? [] : data.results.filter((r) => r.what.trim() || r.result.trim());
  const photos = teamsMode ? [] : data.photos.slice(0, 8); // match par équipes : les photos sont À CÔTÉ de leur équipe (une par rencontre)
  const logos = partners ?? [];

  // Même principe que l'affiche d'un événement : on mesure, puis on agrandit ou réduit le contenu pour remplir la place libre
  const body = useRef<HTMLDivElement>(null); const [k, setK] = useState(1);
  const g = 1 + (fmt?.tout?.size ?? 0) * 0.08; // taille choisie par le coach : appliquée APRÈS l'ajustement automatique
  const sig = JSON.stringify([fmt, e, format, data.headline, data.message, results, matches.map(({ m, i }) => ({ ...m, i, photo: m.photo ? m.photo.length : 0 })), photos.length, data.zoom, data.focus, logos.length]);
  useLayoutEffect(() => {
    const el = body.current; if (!el) return;
    // La phrase « TC Houdan bat TC Dreux » reste sur UNE ligne : sa taille se réduit juste assez pour tenir à côté du score
    const fit = () => el.querySelectorAll<HTMLElement>("[data-fit]").forEach((n) => { let s = 1; n.style.setProperty("--fs", "1"); while (n.scrollWidth > n.clientWidth + 1 && s > 0.35) { s -= 0.04; n.style.setProperty("--fs", s.toFixed(2)); } });
    const run = () => {
      const inner = el.firstElementChild as HTMLElement; if (!inner) return;
      const cs = getComputedStyle(el); const avail = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); let kk = 1; inner.style.height = "auto";
      for (let i = 0; i < 4; i++) {
        el.style.setProperty("--k", String(kk)); fit(); const hh = inner.scrollHeight; if (hh <= 0) break;
        const next = Math.max(0.5, Math.min(1.6, kk * (avail * 0.95) / hh)); if (Math.abs(next - kk) < 0.01) { kk = next; break; } kk = next;
      }
      el.style.setProperty("--k", String(kk)); fit();
      for (let i = 0; i < 12 && inner.scrollHeight > avail && kk > 0.45; i++) { kk *= 0.96; el.style.setProperty("--k", String(kk)); fit(); }
      el.style.setProperty("--k", String(kk * g)); fit(); inner.style.height = "100%"; setK(kk);
    };
    run();
    const fonts = (document as any).fonts; if (fonts?.ready) fonts.ready.then(run).catch(() => {});
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = (n: number) => `calc(${n}px * var(--k))`;
  const hdH = sq ? 100 : 112, ftH = sq ? 96 : 104, partH = logos.length ? 92 : 0, px = 56;
  const longest = Math.max(...name.split(/\s+/).map((x) => x.length), 4);
  const title: CSSProperties = { margin: 0, fontFamily: SERIF, fontStretch: "normal", fontSize: teamsMode ? `min(${p(sq ? 66 : 76)}, ${Math.floor((w - px * 2 - 4) / (name.length * 0.5))}px)` : `min(${p(sq ? 74 : 88)}, ${Math.floor((w - px * 2 - 4) / (longest * 0.7))}px)`, lineHeight: 0.98, fontWeight: 900, letterSpacing: "-0.02em", color: NAVY };
  const card: CSSProperties = { flexShrink: 0, border: `2px solid ${LINE}`, borderLeft: `8px solid ${acc}`, borderRadius: 14, background: "#fff", padding: `${p(12)} ${p(18)}` };
  const head = (t: string) => <div style={{ fontSize: p(15), fontWeight: 900, letterSpacing: "0.16em", color: acc, marginBottom: p(8) }}>{t}</div>;

  // Photos : de 1 à 8, rangées égales ; en prévisualisation, glisser une photo déplace le cadrage dedans
  const layout = PHOTO_ROWS[photos.length] ?? [];
  const rows = layout.length;
  const cells = layout.flatMap((n, r) => Array.from({ length: n }, () => ({ r, span: 12 / n })));
  const pan = (i: number) => (ev: React.PointerEvent<HTMLImageElement>) => {
    if (!onPan) return;
    const el = ev.currentTarget; const rect = el.getBoundingClientRect(); const k = rect.width / el.offsetWidth || 1;
    const f = data.focus?.[i] ?? [50, 50]; const x0 = ev.clientX, y0 = ev.clientY;
    el.setPointerCapture(ev.pointerId);
    const move = (m: PointerEvent) => onPan(i, Math.max(0, Math.min(100, f[0] - ((m.clientX - x0) / k / el.offsetWidth) * 140)), Math.max(0, Math.min(100, f[1] - ((m.clientY - y0) / k / el.offsetHeight) * 140)));
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  const panM = (i: number, f0: [number, number]) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!onPanMatch) return;
    const el = ev.currentTarget; const rect = el.getBoundingClientRect(); const kk = rect.width / el.offsetWidth || 1; const x0 = ev.clientX, y0 = ev.clientY;
    el.setPointerCapture(ev.pointerId);
    const move = (mv: PointerEvent) => onPanMatch(i, Math.max(0, Math.min(100, f0[0] - ((mv.clientX - x0) / kk / el.offsetWidth) * 140)), Math.max(0, Math.min(100, f0[1] - ((mv.clientY - y0) / kk / el.offsetHeight) * 140)));
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  const grid = photos.length > 0 && (
    <div style={{ display: "grid", gap: p(8), gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: `repeat(${rows}, ${p((lite ? (sq ? 440 : 600) : (sq ? 330 : 420)) / rows)})`, flexShrink: 0, borderRadius: 16, overflow: "hidden", fontVariantNumeric: "lining-nums" }}>
      {photos.map((src, i) => { const f = data.focus?.[i] ?? [50, 50], z = data.zoom?.[i] ?? 1; return <div key={i} style={{ gridColumn: `span ${cells[i].span}`, gridRow: cells[i].r + 1, minWidth: 0, minHeight: 0, overflow: "hidden", position: "relative" }}><img src={src} alt="" draggable={false} onPointerDown={pan(i)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${f[0]}% ${f[1]}%`, transform: `scale(${z})`, transformOrigin: `${f[0]}% ${f[1]}%`, display: "block", cursor: onPan ? "grab" : undefined, touchAction: onPan ? "none" : undefined }} /></div>; })}
    </div>
  );

  return (
    <div onClick={(ev) => pickFmt(ev, onPick)} style={{ position: "relative", width: w, height: h, overflow: "hidden", background: "#fff", color: NAVY, fontFamily: FONT, lineHeight: 1.25, fontWeight: 400, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <FmtStyle fmts={fmt} />
      <Backdrop bg={bg} w={w} h={h} veil="strong" />
      <div aria-hidden style={{ position: "absolute", right: -30, bottom: ftH + partH - 40, fontSize: 420, lineHeight: 1, opacity: 0.06, filter: "grayscale(1)" }}>{kd.icon}</div>
      <div style={{ position: "relative", height: hdH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 16, padding: `0 ${px}px` }}>
        <span aria-hidden style={{ display: "inline-block", width: hdH - 36, height: hdH - 36, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
        <div style={{ whiteSpace: "nowrap" }}><div data-fmt="entete" style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.32em", color: GOLD }}>{txt(fmt, "entete", "TENNIS CLUB HOUDAN")}</div></div>
        <div data-fmt="type" style={{ marginLeft: "auto", background: acc, color: "#fff", borderRadius: 99, padding: "10px 20px", fontWeight: 900, fontSize: 15, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{txt(fmt, "type", "BILAN")}</div>
      </div>
      <div style={{ position: "relative", height: 10, background: `linear-gradient(90deg,${acc},${GOLD})` }} />
      <div ref={body} style={{ position: "absolute", left: 0, right: 0, top: hdH + 10, bottom: ftH + partH, padding: `${sq ? 24 : 30}px ${px}px ${sq ? 20 : 26}px`, ["--k" as any]: k * g }}>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: p(14) }}>
          <div>
            {data.headline.trim() && <div data-fmt="surtitre" style={{ fontSize: p(sq ? 24 : 28), fontWeight: 900, letterSpacing: "0.18em", color: acc, marginBottom: p(6) }}>{txt(fmt, "surtitre", data.headline.trim()).toUpperCase()}</div>}
            <div data-fmt="titre" role="heading" aria-level={1} style={title}>{txt(fmt, "titre", name)}</div>
            {rankLine && <div data-fmt="classement" style={{ marginTop: p(8), fontSize: p(sq ? 30 : 34), fontWeight: 900, color: acc }}>{rankLine}</div>}
            {!(teamsMode && matches.length > 0) && <div data-fmt="date" style={{ marginTop: p(8), fontSize: p(sq ? 24 : 28), fontWeight: 800 }}>{txt(fmt, "date", fullRange(e).replace(/^./, (c) => c.toUpperCase()))}</div>}
          </div>
          {grid}
          {matches.length > 0 && (
            <div style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: p(10) }}>
              {matches.map(({ m, i }) => {
                const one = matches.length === 1, many = matches.length > 3, oc = outcomeColor(m), ow = outcomeWord(m);
                const raw = (fmt as Record<string, { text?: string } | undefined> | undefined)?.[`ph-${i}`]?.text;
                const [cat, num] = m.team ? teamParts(m.team) : ["Rencontre", ""];
                const ph = m.photo; const f0 = m.focus ?? [50, 50];
                const phW = one ? 330 : many ? 150 : 215;
                const dayTxt = (m.date || e.startDate) ? fmtDay(m.date || e.startDate).replace(/^./, (c) => c.toUpperCase()) : "";
                return (
                  <div key={i}>
                  {dayTxt && <div data-fmt={`dt-${i}`} style={{ fontSize: p(one ? 28 : 24), fontWeight: 900, color: acc, letterSpacing: "0.04em", margin: `0 0 ${p(6)} ${p(4)}` }}>{txt(fmt, `dt-${i}`, dayTxt)}</div>}
                  <div style={{ ...card, display: "flex", alignItems: "stretch", gap: p(16), borderLeft: `10px solid ${oc}`, padding: p(10) }}>
                    {ph && <div role="img" aria-label="Photo de l'équipe" onPointerDown={panM(i, f0)} style={{ flex: `0 0 ${p(phW * (m.size ?? 1))}`, minHeight: p((one ? 250 : many ? 110 : 150) * (m.size ?? 1)), borderRadius: 10, overflow: "hidden", position: "relative", background: "#e4dccb", cursor: onPanMatch ? "grab" : undefined, touchAction: onPanMatch ? "none" : undefined }}>
                      <img src={ph} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${f0[0]}% ${f0[1]}%`, transform: `scale(${m.zoom ?? 1})`, transformOrigin: `${f0[0]}% ${f0[1]}%`, pointerEvents: "none" }} />
                      {num && <div data-fmt={`nu-${i}`} style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", padding: `${p(18)} ${p(6)} ${p(6)}`, background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.72))", color: "#fff", fontSize: p(one ? 24 : 20), fontWeight: 900, letterSpacing: "0.06em", textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>{txt(fmt, `nu-${i}`, num)}</div>}
                    </div>}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: p(6), padding: `${p(4)} 0` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: p(10) }}>
                        <div style={{ lineHeight: 1.15, minWidth: 0, flex: 1 }}>
                          <div data-fmt={`eq-${i}`} style={{ fontSize: p(one ? 28 : 24), color: NAVY, fontWeight: 900 }}>{txt(fmt, `eq-${i}`, cat)}</div>
                          {num && !ph && <div data-fmt={`nu-${i}`} style={{ fontSize: p(one ? 22 : 19), fontWeight: 800, color: MUTED }}>{txt(fmt, `nu-${i}`, num)}</div>}
                        </div>
                        {ow && <div data-fmt={`rs-${i}`} style={{ flex: "0 0 auto", background: oc, color: "#fff", borderRadius: 99, padding: `${p(4)} ${p(14)}`, fontSize: p(15), fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>{txt(fmt, `rs-${i}`, ow)}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: p(14) }}>
                        <div data-fmt={`ph-${i}`} data-fit style={{ flex: 1, minWidth: 0, fontSize: `calc(${p(one ? 34 : many ? 22 : 26)} * var(--fs, 1))`, fontWeight: 900, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden" }}>{typeof raw === "string" ? raw : (() => { const [a, v, o] = matchParts(m); return <><span style={{ whiteSpace: "nowrap" }}>{a}</span> {v} <span style={{ whiteSpace: "nowrap" }}>{o}</span></>; })()}</div>
                        {m.us.trim() !== "" && m.them.trim() !== "" && <div data-fmt={`sc-${i}`} style={{ flex: "0 0 auto", fontSize: p(one ? 80 : many ? 44 : 54), fontWeight: 900, lineHeight: 1, color: oc, whiteSpace: "nowrap" }}>{txt(fmt, `sc-${i}`, `${m.us.trim()}/${m.them.trim()}`)}</div>}
                      </div>
                    </div>
                  </div></div>);
              })}
            </div>
          )}
          {results.length > 0 && (
            <div data-fmt="resultats" style={card}>
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
          {txt(fmt, "texte", data.message.trim()) && <p data-fmt="texte" style={{ margin: 0, borderLeft: `6px solid ${acc}`, paddingLeft: p(18), fontSize: p(lite ? 28 : 24), lineHeight: 1.35, fontStyle: "italic", color: "#3a352c", overflowWrap: "break-word" }}><NoBreak text={glue(txt(fmt, "texte", data.message.trim()))} /></p>}
        </div>
      </div>
      {logos.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: ftH, height: partH, background: "#fff", borderTop: `3px solid ${acc}`, display: "flex", alignItems: "center", gap: 18, padding: `0 ${px}px` }}>
          <div data-fmt="partenaires" style={{ flex: "0 0 auto", fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", color: acc, lineHeight: 1.3 }}>MERCI À<br />NOS PARTENAIRES</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-around", gap: 14, height: partH - 28 }}>
            {logos.map((l, i) => <img key={i} src={l} alt="" style={{ flex: "1 1 0", minWidth: 0, maxWidth: 170, height: "100%", objectFit: "contain" }} />)}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ftH, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: `0 ${px}px` }}>
        <div data-fmt="pied" style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.04em" }}>{txt(fmt, "pied", "Merci à tous !")}</div>
        <div data-fmt="mail" style={{ fontSize: 15, opacity: 0.92, whiteSpace: "nowrap" }}>{txt(fmt, "mail", "tennisclubhoudan@gmail.com")}</div>
        <span aria-hidden style={{ display: "inline-block", width: 60, height: 60, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
      </div>
    </div>
  );
}
