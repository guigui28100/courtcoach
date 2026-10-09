import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, del } from "../api";
import { Err } from "./ui";
import { useVideos } from "./Videos";
import { VideoDetail } from "../types";
import { PoseOverlay } from "./PoseOverlay";
import { createLandmarker, defaultSkeleton, drawSkeleton, JOINT_LABEL, Joint, measures, nearestJoint, Skeleton, toSkeleton } from "./skeleton";

type Pt = [number, number];
type Tool = "line" | "arrow" | "circle" | "free" | "angle" | "text";
interface Shape { tool: Tool; color: string; pts: Pt[]; text?: string; size?: number; }
const SIZES: [string, number][] = [["Fin", 0.6], ["Moyen", 1], ["Épais", 1.8], ["Très épais", 2.8]];
const COLORS: [string, string][] = [["#e11d48", "Rouge"], ["#facc15", "Jaune"], ["#38bdf8", "Bleu"], ["#ffffff", "Blanc"]];
const TOOLS: [Tool, string][] = [["line", "Ligne"], ["arrow", "Flèche"], ["circle", "Cercle"], ["free", "Trait libre"], ["angle", "Angle (3 points)"], ["text", "Texte"]];
const FPS = 30; // une « image » = 1/30 de seconde (la plupart des téléphones filment à 30 images par seconde)

// Fabrique un JPEG à partir du dessin. Certains navigateurs (protection de la vie privée, Safari…) ne répondent pas à toBlob :
// après 4 secondes, on passe par toDataURL.
function jpeg(c: HTMLCanvasElement, q: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    let done = false;
    const viaUrl = () => {
      if (done) return; done = true;
      try {
        const b64 = c.toDataURL("image/jpeg", q).split(",")[1] ?? "";
        const bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        resolve(bytes.length ? new Blob([bytes], { type: "image/jpeg" }) : null);
      } catch { resolve(null); }
    };
    const t = setTimeout(viaUrl, 4000);
    try { c.toBlob((b) => { if (done) return; done = true; clearTimeout(t); resolve(b); }, "image/jpeg", q); } catch { clearTimeout(t); viaUrl(); }
  });
}

const angleOf = (a: Pt, b: Pt, c: Pt) => {
  const v1: Pt = [a[0] - b[0], a[1] - b[1]], v2: Pt = [c[0] - b[0], c[1] - b[1]];
  const n = Math.hypot(...v1) * Math.hypot(...v2);
  if (!n) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))) * 180) / Math.PI;
};

function drawShape(g: CanvasRenderingContext2D, s: Shape, w: number, h = w) {
  const lw = Math.max(2, (w / 220) * (s.size ?? 1));
  g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = lw; g.lineCap = "round"; g.lineJoin = "round";
  const [a, b, c] = s.pts;
  if (s.tool === "text") {
    const size = Math.max(16, Math.min(w / 26, h / 12)) * Math.max(0.8, Math.min(1.4, s.size ?? 1));
    g.font = `bold ${size}px sans-serif`; g.textAlign = "left"; g.textBaseline = "middle"; g.lineWidth = size / 5; g.strokeStyle = "#10203a"; g.fillStyle = s.color;
    // Le texte revient à la ligne pour rester dans l'image : on coupe aux espaces (et au milieu d'un mot trop long)
    const maxW = Math.min(w - 16, w * 0.7), lines: string[] = [];
    let cur = "";
    for (const word of (s.text ?? "").split(/\s+/).filter(Boolean)) {
      let wd = word;
      while (g.measureText(wd).width > maxW && wd.length > 1) { let k = wd.length - 1; while (k > 1 && g.measureText(wd.slice(0, k)).width > maxW) k--; if (cur) { lines.push(cur); cur = ""; } lines.push(wd.slice(0, k)); wd = wd.slice(k); }
      const test = cur ? `${cur} ${wd}` : wd;
      if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = test;
    }
    if (cur) lines.push(cur);
    const lh = size * 1.2, blockW = Math.max(...lines.map((l) => g.measureText(l).width), 0), blockH = lines.length * lh;
    const x = Math.max(8, Math.min(a[0], w - 8 - blockW)); // le bloc reste entièrement dans l'image
    const y0 = Math.max(8, Math.min(a[1] - lh / 2, h - 8 - blockH));
    lines.forEach((l, i) => { g.strokeText(l, x, y0 + i * lh + lh / 2); g.fillText(l, x, y0 + i * lh + lh / 2); });
    return;
  }
  g.beginPath();
  if (s.tool === "free") { s.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); return; }
  if (s.tool === "line" && b) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  if (s.tool === "arrow" && b) {
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    const t = Math.atan2(b[1] - a[1], b[0] - a[0]), h = lw * 5;
    g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - h * Math.cos(t - 0.45), b[1] - h * Math.sin(t - 0.45)); g.lineTo(b[0] - h * Math.cos(t + 0.45), b[1] - h * Math.sin(t + 0.45)); g.closePath(); g.fill();
  }
  if (s.tool === "circle" && b) { g.arc(a[0], a[1], Math.hypot(b[0] - a[0], b[1] - a[1]), 0, Math.PI * 2); g.stroke(); }
  if (s.tool === "angle") {
    g.arc(a[0], a[1], lw * 1.6, 0, Math.PI * 2); g.fill();
    if (b) {
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.beginPath(); g.arc(b[0], b[1], lw * 1.6, 0, Math.PI * 2); g.fill();
    }
    if (b && c) {
      g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
      g.beginPath(); g.arc(c[0], c[1], lw * 1.6, 0, Math.PI * 2); g.fill();
      const a1 = Math.atan2(a[1] - b[1], a[0] - b[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const r = Math.min(60, Math.hypot(a[0] - b[0], a[1] - b[1]) / 2, Math.hypot(c[0] - b[0], c[1] - b[1]) / 2);
      g.beginPath(); g.arc(b[0], b[1], r, a1, a1 + d, d < 0); g.stroke();
      const mid = a1 + d / 2, label = `${Math.round(angleOf(a, b, c))}°`;
      g.font = `bold ${Math.max(18, w / 28)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      const lx = b[0] + Math.cos(mid) * (r + g.measureText(label).width * 0.8), ly = b[1] + Math.sin(mid) * (r + 22);
      g.lineWidth = lw * 1.6; g.strokeStyle = "#10203a"; g.strokeText(label, lx, ly); g.fillStyle = s.color; g.fillText(label, lx, ly);
    }
  }
}

// Éditeur d'une image figée : dessiner, mesurer un angle, puis l'enregistrer dans l'analyse.
function Annotator({ base, onCancel, onSave, initialSkeleton = null }: { base: HTMLCanvasElement; onCancel: () => void; onSave: (blob: Blob, note: string) => Promise<void>; initialSkeleton?: Skeleton | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0][0]);
  const [size, setSize] = useState(1); // épaisseur du trait (ou taille du texte)
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [typing, setTyping] = useState<{ p: Pt; left: number; top: number; text: string } | null>(null);
  // Squelette du joueur : déplaçable point par point, avec repères d'alignement et mesures
  const [skel, setSkel] = useState<Skeleton | null>(initialSkeleton);
  const [guides, setGuides] = useState(true), [showMeasures, setShowMeasures] = useState(true);
  const [drag, setDrag] = useState<Joint | null>(null);
  const [detecting, setDetecting] = useState(false), [skMsg, setSkMsg] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, []); // l'éditeur apparaît à l'écran dès la capture
  const W = base.width, H = base.height;

  const paint = useCallback((target: HTMLCanvasElement, list: Shape[]) => {
    const g = target.getContext("2d")!;
    g.clearRect(0, 0, W, H); g.drawImage(base, 0, 0);
    list.forEach((s) => drawShape(g, s, W, H));
    if (skel) drawSkeleton(g, skel, 0, 0, W, H, { guides, labels: showMeasures, active: drag });
  }, [base, W, H, skel, guides, showMeasures, drag]);
  useEffect(() => { if (cv.current) paint(cv.current, draft ? [...shapes, draft] : shapes); }, [shapes, draft, paint]);

  async function detect() {
    setSkMsg(""); setDetecting(true);
    try {
      const lm = await createLandmarker("IMAGE");
      try { const sk = toSkeleton(lm.detect(base)); if (sk) { setSkel(sk); setSkMsg("Joueur repéré. Glisse les points blancs pour corriger ce qui est mal placé."); } else setSkMsg("Aucun joueur repéré sur cette image : place le squelette à la main."); }
      finally { lm.close(); }
    } catch (x) { setSkMsg("Le suivi automatique n'a pas pu démarrer sur cet appareil (" + ((x as Error).message || "erreur") + "). Place le squelette à la main."); }
    finally { setDetecting(false); }
  }

  const at = (e: PointerEvent<HTMLCanvasElement>): Pt => { const r = cv.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  const norm = (p: Pt): Pt => [Math.max(0, Math.min(1, p[0] / W)), Math.max(0, Math.min(1, p[1] / H))];
  function down(e: PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const p = at(e);
    if (skel) { // près d'un point du squelette : on le déplace au lieu de dessiner
      const rect = cv.current!.getBoundingClientRect(), j = nearestJoint(skel, norm(p), W, H, 26 * (W / rect.width));
      if (j) { (e.target as Element).setPointerCapture(e.pointerId); setDrag(j); return; }
    }
    if (tool === "text") { const r = cv.current!.getBoundingClientRect(); setTyping({ p, left: e.clientX - r.left, top: e.clientY - r.top, text: "" }); return; }
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === "angle") {
      if (draft && draft.tool === "angle" && draft.pts.length < 3) { const next = { ...draft, pts: [...draft.pts, p] }; if (next.pts.length === 3) { setShapes((l) => [...l, next]); setDraft(null); } else setDraft(next); }
      else setDraft({ tool, color, size, pts: [p] });
      return;
    }
    setDraft({ tool, color, size, pts: tool === "free" ? [p] : [p, p] });
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (drag && skel) { const np = norm(at(e)); setSkel({ ...skel, [drag]: np }); return; }
    if (!draft) return;
    const p = at(e);
    if (draft.tool === "free") setDraft({ ...draft, pts: [...draft.pts, p] });
    else if (draft.tool === "angle") return;
    else if (e.buttons) setDraft({ ...draft, pts: [draft.pts[0], p] });
  }
  function up() {
    if (drag) { setDrag(null); return; }
    if (!draft || draft.tool === "angle") return;
    const moved = draft.tool === "free" ? draft.pts.length > 2 : Math.hypot(draft.pts[1][0] - draft.pts[0][0], draft.pts[1][1] - draft.pts[0][1]) > 4;
    if (moved) setShapes((l) => [...l, draft]);
    setDraft(null);
  }

  function commitText() {
    if (typing && typing.text.trim()) setShapes((l) => [...l, { tool: "text", color, size, pts: [typing.p], text: typing.text.trim().slice(0, 200) }]);
    setTyping(null);
  }

  async function save() {
    if (busy) return;
    setErr(""); setBusy(true); setStep("Création de l'image…");
    try {
      const out = document.createElement("canvas"); out.width = W; out.height = H; paint(out, shapes);
      let blob: Blob | null = null;
      for (const [scale, q] of [[1, 0.85], [1, 0.7], [0.75, 0.7], [0.55, 0.65]] as const) {
        const c = document.createElement("canvas"); c.width = Math.round(W * scale); c.height = Math.round(H * scale); c.getContext("2d")!.drawImage(out, 0, 0, c.width, c.height);
        blob = await jpeg(c, q);
        if (blob && blob.size <= 650 * 1024) break;
      }
      if (!blob) throw new Error("Impossible de créer l'image. Essaie un autre navigateur (Chrome ou Safari à jour).");
      setStep("Envoi au serveur…");
      await onSave(blob, note);
    } catch (x) { setErr(((x as Error).name === "AbortError" ? "Le serveur ne répond pas (30 secondes). Réessaie dans un instant." : (x as Error).message) || "L'enregistrement a échoué."); setBusy(false); }
  }

  const pending = draft?.tool === "angle" ? 3 - draft.pts.length : null;
  return (
    <div ref={box} className="card grid gap-3" aria-label="Annoter l'image">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Outils de dessin">
        {TOOLS.map(([k, label]) => <button key={k} type="button" aria-pressed={tool === k} onClick={() => { setTool(k); setDraft(null); }} className={"btn-sm btn " + (tool === k ? "bg-ink text-white" : "border-2 border-line bg-white text-ink")}>{label}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Épaisseur du trait">
        <span className="text-sm font-bold">{tool === "text" ? "Taille du texte" : "Épaisseur"} :</span>
        {SIZES.map(([label, v]) => (
          <button key={label} type="button" role="radio" aria-checked={size === v} onClick={() => setSize(v)} aria-label={label} title={label}
            className={"flex h-10 min-w-16 items-center justify-center gap-2 rounded-xl border-2 px-2 text-sm font-bold " + (size === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}>
            {tool === "text" ? <span style={{ fontSize: `${10 + v * 5}px`, lineHeight: 1 }}>Aa</span> : <span aria-hidden="true" className="block w-7 rounded-full bg-current" style={{ height: `${Math.max(2, v * 3)}px` }} />}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Couleur">
        {COLORS.map(([c, label]) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={label} onClick={() => setColor(c)} className={"h-9 w-9 rounded-full border-2 " + (color === c ? "border-ink ring-2 ring-ink" : "border-line")} style={{ background: c }} />)}
        <button type="button" className="btn-outline btn-sm" disabled={!shapes.length} onClick={() => setShapes((l) => l.slice(0, -1))}>Annuler le dernier tracé</button>
        <button type="button" className="btn-outline btn-sm" disabled={!shapes.length && !draft} onClick={() => { setShapes([]); setDraft(null); }}>Tout effacer</button>
      </div>
      <section className="grid gap-2 rounded-xl border-2 border-line bg-white p-3" aria-label="Squelette du joueur">
        <div className="flex flex-wrap items-center gap-2">
          <strong>🦴 Squelette</strong>
          <button type="button" className="btn-clay btn-sm" disabled={detecting} onClick={() => void detect()}>{detecting ? "Recherche du joueur…" : "🤖 Repérer le joueur automatiquement"}</button>
          {!skel && <button type="button" className="btn-outline btn-sm" onClick={() => { setSkel(defaultSkeleton()); setSkMsg("Squelette posé : glisse chaque point blanc à sa place sur le joueur."); }}>Placer un squelette à la main</button>}
          {skel && <button type="button" className="btn-outline btn-sm" onClick={() => { setSkel(null); setSkMsg(""); }}>Retirer le squelette</button>}
        </div>
        {skMsg && <p role="status" className="m-0 text-sm font-bold">{skMsg}</p>}
        {skel && (
          <>
            <div className="flex flex-wrap gap-4 text-sm font-bold">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-clay" checked={guides} onChange={(e) => setGuides(e.target.checked)} />Repères d'alignement (verticale et ligne tête–bassin–pieds)</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-clay" checked={showMeasures} onChange={(e) => setShowMeasures(e.target.checked)} />Écrire les mesures sur l'image</label>
            </div>
            <p className="hint m-0">Glisse un point blanc pour le replacer (ex. : {JOINT_LABEL.rElbow.toLowerCase()}). Les mesures se mettent à jour tout de suite.</p>
            <ul className="m-0 grid list-none gap-1 p-0 text-sm sm:grid-cols-2" aria-label="Mesures du squelette">
              {measures(skel, W, H).map((m) => <li key={m.key} className="flex items-baseline justify-between gap-2 rounded-lg bg-sand/60 px-2 py-1" title={m.hint}><span>{m.label}</span><strong className="whitespace-nowrap">{m.value}</strong></li>)}
            </ul>
            <p className="hint m-0">Mesures faites sur une image à plat : elles sont indicatives (la perspective de la caméra les déforme un peu).</p>
          </>
        )}
      </section>
      {tool === "text" && <p className="hint m-0">Clique à l'endroit où le texte doit apparaître, écris, puis appuie sur Entrée. Choisis la couleur avant de cliquer.</p>}
      {tool === "angle" && <p className="hint m-0">{pending === null ? "Clique 3 points : le début d'un segment, le sommet de l'angle (l'articulation), puis la fin du second segment. L'angle s'affiche en degrés." : `Encore ${pending} point${pending > 1 ? "s" : ""} à cliquer.`}</p>}
      <div className="relative">
        <canvas ref={cv} width={W} height={H} role="img" aria-label="Image de la vidéo à annoter, avec les tracés du coach" className="w-full touch-none rounded-xl bg-black" style={{ cursor: "crosshair", maxHeight: "70vh", objectFit: "contain" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDraft(null)} />
        {typing && (
          <input autoFocus aria-label="Texte à écrire sur l'image" maxLength={200} value={typing.text} onChange={(e) => setTyping({ ...typing, text: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitText(); } if (e.key === "Escape") setTyping(null); }} onBlur={commitText}
            className="absolute z-10 w-56 max-w-[80%] -translate-y-1/2 rounded-lg border-2 border-ink bg-white px-2 py-1 text-base text-ink shadow-lg" style={{ left: Math.min(typing.left, 9999), top: typing.top }} placeholder="Écris ici, puis Entrée" />
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3" noValidate>
        <div className="field"><label htmlFor="cap-note">Commentaire sur cette image (facultatif)</label><input id="cap-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Le coude est trop bas à l'impact" enterKeyHint="done" /></div>
        {busy && <p role="status" className="m-0 font-bold">{step || "Enregistrement…"}</p>}
        <Err msg={err} />
        <div className="flex flex-wrap gap-2"><button type="submit" className="btn-clay" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer dans l'analyse"}</button><button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>Annuler</button></div>
      </form>
    </div>
  );
}

const SPEEDS = [0.25, 0.5, 1];
const fmtS = (t: number) => `${t.toFixed(2).replace(".", ",")} s`;
const frDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

// Enregistre une image annotée dans l'analyse d'une vidéo.
// 1) un petit appel « réveille » le serveur (il peut dormir quelques secondes) et compte les images déjà là ;
// 2) l'envoi attend 30 secondes ; 3) en cas de silence, on vérifie si l'image est quand même arrivée, sinon on réessaie UNE fois (jamais de doublon).
async function saveImage(videoId: string, blob: Blob, note: string) {
  const count = async () => { try { return ((await api<{ images?: unknown[] }>(`/videos/${videoId}`)).images ?? []).length; } catch { return null; } };
  const send = async (ms: number) => {
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), ms);
    try { await api(`/videos/${videoId}/images?note=${encodeURIComponent(note)}`, { method: "POST", body: blob, headers: { "Content-Type": "application/octet-stream" }, signal: stop.signal }); }
    finally { clearTimeout(timer); }
  };
  const before = await count();
  try { await send(30000); return; } catch (x) {
    if ((x as Error).name !== "AbortError") throw x;
    const now = await count();
    if (before !== null && now !== null && now > before) return; // l'image était bien arrivée, seule la réponse s'est perdue
  }
  await send(45000); // deuxième et dernier essai
}

// Un lecteur de la comparaison : image par image, curseur, et « le geste démarre ici ».
function ComparePane({ label, src, vref, start, onStart, onTime, pose = false, guides = true, onSkeleton }: { label: string; src: string; vref: React.RefObject<HTMLVideoElement | null>; start: number; onStart: (t: number) => void; onTime: () => void; pose?: boolean; guides?: boolean; onSkeleton?: (s: Skeleton | null) => void }) {
  const [pos, setPos] = useState(0), [dur, setDur] = useState(0);
  const el = () => vref.current;
  const go = (t: number) => { const v = el(); if (!v) return; v.pause(); v.currentTime = Math.max(0, Math.min(Number.isFinite(v.duration) ? v.duration : t, t)); };
  return (
    <div className="grid content-start gap-2">
      <p className="m-0 font-bold">{label}</p>
      <div className="relative">
      <video ref={vref} src={src} playsInline preload="auto" muted className="block w-full rounded-xl bg-black" aria-label={label}
        onLoadedMetadata={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onDurationChange={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={(e) => { setPos(e.currentTarget.currentTime); onTime(); }} onSeeked={(e) => setPos(e.currentTarget.currentTime)} />
      <PoseOverlay video={vref} active={pose} guides={guides} onSkeleton={onSkeleton} />
      </div>
      <label className="flex items-center gap-2 text-sm font-bold">Position<input type="range" min={0} max={Math.max(dur, pos, 1)} step={1 / FPS} value={pos} className="flex-1 accent-clay" onChange={(e) => go(Number(e.target.value))} aria-label={`Position dans ${label}`} /><output>{fmtS(pos)}</output></label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-outline btn-sm" onClick={() => go(pos - 1 / FPS)} aria-label={`${label} : reculer d'une image`}>◀ 1 image</button>
        <button className="btn-outline btn-sm" onClick={() => go(pos + 1 / FPS)} aria-label={`${label} : avancer d'une image`}>1 image ▶</button>
        <button className="btn-clay btn-sm" onClick={() => onStart(el()?.currentTime ?? 0)}>🎯 Le geste démarre ici</button>
      </div>
      <p className="hint m-0">Départ du geste : <strong>{fmtS(start)}</strong></p>
    </div>
  );
}

// Comparaison côte à côte de deux vidéos du même élève, calées sur le départ du geste, avec capture et annotation.
export function Compare({ v, onClose, onChanged }: { v: VideoDetail; onClose: () => void; onChanged: () => void }) {
  const all = useVideos() ?? [];
  const options = all.filter((o) => o.id !== v.id && o.kind === v.kind && (v.kind === "centre" ? o.player?.id === v.player?.id : o.owner?.id === v.owner?.id)).sort((x, y) => +new Date(x.recordedAt) - +new Date(y.recordedAt));
  const [otherId, setOtherId] = useState("");
  const other = options.find((o) => o.id === otherId);
  // La vidéo la plus ancienne est toujours à gauche (1), la plus récente à droite (2) : on lit l'évolution dans le temps.
  const pair = other ? [{ id: v.id, title: v.title, recordedAt: v.recordedAt }, { id: other.id, title: other.title, recordedAt: other.recordedAt }].sort((x, y) => +new Date(x.recordedAt) - +new Date(y.recordedAt)) : [];
  const a = useRef<HTMLVideoElement>(null), b = useRef<HTMLVideoElement>(null);
  const [startA, setStartA] = useState(0), [startB, setStartB] = useState(0);
  const [speed, setSpeed] = useState(1), [playing, setPlaying] = useState(false);
  const [pose, setPose] = useState(false), [guides, setGuides] = useState(true);
  const [t, setT] = useState(0);
  const [frame, setFrame] = useState<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState(""), [done, setDone] = useState("");
  const startRef = useRef({ a: 0, b: 0 }); startRef.current = { a: startA, b: startB };
  const skA = useRef<Skeleton | null>(null), skB = useRef<Skeleton | null>(null);
  const dur = (el: HTMLVideoElement | null) => (el && Number.isFinite(el.duration) ? el.duration : 1e9);
  const clamp = (x: number, el: HTMLVideoElement | null) => Math.max(0, Math.min(dur(el), x));

  // t = temps écoulé depuis le départ du geste (négatif avant le départ). Les deux vidéos sont toujours calées sur t.
  const seekBoth = useCallback((time: number) => {
    const { a: sa, b: sb } = startRef.current;
    if (a.current) a.current.currentTime = clamp(sa + time, a.current);
    if (b.current) b.current.currentTime = clamp(sb + time, b.current);
    setT(time);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pauseBoth = () => { a.current?.pause(); b.current?.pause(); setPlaying(false); };
  const playBoth = () => { void a.current?.play(); void b.current?.play(); setPlaying(true); };
  useEffect(() => { [a.current, b.current].forEach((el) => el && (el.playbackRate = speed)); }, [speed, otherId]);

  // Pendant la lecture, la deuxième vidéo est recalée sur la première si elle dérive de plus de 0,06 s.
  const follow = useCallback(() => {
    const A = a.current, B = b.current; if (!A || !B) return;
    const { a: sa, b: sb } = startRef.current;
    setT(A.currentTime - sa);
    if (!A.paused && !A.ended && !B.ended) { const want = clamp(sb + (A.currentTime - sa), B); if (Math.abs(B.currentTime - want) > 0.06) B.currentTime = want; }
    if (A.ended && B.ended) setPlaying(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tMin = -Math.max(startA, startB), tMax = Math.max(Number.isFinite(a.current?.duration ?? NaN) ? a.current!.duration - startA : 5, Number.isFinite(b.current?.duration ?? NaN) ? b.current!.duration - startB : 5);

  function capture() {
    setErr(""); setDone("");
    const A = a.current, B = b.current;
    if (!A || !B || !A.videoWidth || !B.videoWidth) return setErr("Les deux vidéos ne sont pas encore prêtes : attends qu'elles s'affichent, puis réessaie.");
    pauseBoth();
    const H = 540, wA = Math.round((A.videoWidth * H) / A.videoHeight), wB = Math.round((B.videoWidth * H) / B.videoHeight), gap = 12;
    const c = document.createElement("canvas"); c.width = wA + wB + gap; c.height = H;
    const g = c.getContext("2d")!; g.fillStyle = "#10203a"; g.fillRect(0, 0, c.width, H);
    g.drawImage(A, 0, 0, wA, H); g.drawImage(B, wA + gap, 0, wB, H);
    if (pose) { if (skA.current) drawSkeleton(g, skA.current, 0, 0, wA, H, { guides, labels: true }); if (skB.current) drawSkeleton(g, skB.current, wA + gap, 0, wB, H, { guides, labels: true }); } // les deux squelettes, avec leurs mesures, pour comparer le placement
    g.font = "bold 24px sans-serif"; g.textBaseline = "top"; g.lineWidth = 5; g.strokeStyle = "#10203a"; g.fillStyle = "#fff";
    const lab = (txt: string, x: number) => { g.strokeText(txt, x + 12, 10); g.fillText(txt, x + 12, 10); };
    lab(`${pair[0].title} · ${frDate(pair[0].recordedAt)}`, 0); lab(`${pair[1].title} · ${frDate(pair[1].recordedAt)}`, wA + gap);
    setFrame(c);
  }

  return (
    <section className="card grid gap-4" aria-label="Comparer deux vidéos">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-xl">Comparer deux vidéos</h2><button className="btn-outline btn-sm" onClick={onClose}>Fermer la comparaison</button></div>
      {options.length === 0 ? <p className="hint m-0">Il n'y a pas d'autre vidéo de {v.kind === "centre" ? "ce joueur" : "cet adhérent"} à comparer. Quand une deuxième vidéo aura été envoyée, tu pourras suivre l'évolution du geste ici.</p> : (
        <div className="field"><label htmlFor="cmp">Vidéo à comparer (de la plus ancienne à la plus récente)</label>
          <select id="cmp" className="input" value={otherId} onChange={(e) => { setOtherId(e.target.value); pauseBoth(); setStartA(0); setStartB(0); setT(0); setFrame(null); }}>
            <option value="">Choisir…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.title} · {frDate(o.recordedAt)} ({o.shot})</option>)}
          </select></div>
      )}
      {other && (
        <>
          <ol className="m-0 list-decimal pl-5 text-sm text-muted"><li>Pour chaque vidéo, avance jusqu'au <strong>début du geste</strong> (par exemple le lancer de balle) puis clique sur « 🎯 Le geste démarre ici ».</li><li>Utilise ensuite les commandes communes : les deux gestes démarrent <strong>en même temps</strong>.</li><li>Fige l'image voulue et annote-la (traits, cercles, angles, texte).</li></ol>
          <div className="grid gap-4 md:grid-cols-2">
            <ComparePane label={`1 · ${pair[0].title} (${frDate(pair[0].recordedAt)})`} src={`/api/videos/${pair[0].id}/file`} vref={a} start={startA} onStart={(x) => { setStartA(x); startRef.current.a = x; setT(0); }} onTime={follow} pose={pose} guides={guides} onSkeleton={(s) => { skA.current = s; }} />
            <ComparePane label={`2 · ${pair[1].title} (${frDate(pair[1].recordedAt)})`} src={`/api/videos/${pair[1].id}/file`} vref={b} start={startB} onStart={(x) => { setStartB(x); startRef.current.b = x; }} onTime={() => undefined} pose={pose} guides={guides} onSkeleton={(s) => { skB.current = s; }} />
          </div>
          <div className="grid gap-2 rounded-xl bg-sand p-3" role="group" aria-label="Commandes communes aux deux vidéos">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-clay btn-sm" onClick={() => (playing ? pauseBoth() : playBoth())}>{playing ? "Pause" : "Lecture synchronisée"}</button>
              <button className="btn-outline btn-sm" onClick={() => { pauseBoth(); seekBoth(Math.max(-0.5, tMin)); }}>↺ Revenir juste avant le geste</button>
              <button className="btn-outline btn-sm" onClick={() => { pauseBoth(); seekBoth(t - 1 / FPS); }} aria-label="Reculer les deux d'une image">◀ 1 image</button>
              <button className="btn-outline btn-sm" onClick={() => { pauseBoth(); seekBoth(t + 1 / FPS); }} aria-label="Avancer les deux d'une image">1 image ▶</button>
              {SPEEDS.map((x) => <button key={x} aria-pressed={speed === x} className={"btn btn-sm " + (speed === x ? "bg-ink text-white" : "border-2 border-line bg-white")} onClick={() => setSpeed(x)}>{x}×</button>)}
            </div>
            <label className="flex items-center gap-3 text-sm font-bold">Depuis le départ du geste<input type="range" min={tMin} max={tMax} step={1 / FPS} value={Math.max(tMin, Math.min(tMax, t))} className="flex-1 accent-clay" onChange={(e) => { pauseBoth(); seekBoth(Number(e.target.value)); }} aria-label="Moment du geste, commun aux deux vidéos" /><output>{t >= 0 ? "+" : ""}{fmtS(t)}</output></label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className={"btn btn-sm " + (pose ? "bg-ink text-white" : "border-2 border-ink bg-white text-ink")} aria-pressed={pose} onClick={() => setPose((x) => !x)}>🦴 {pose ? "Arrêter le suivi du squelette" : "Suivre le squelette sur les deux vidéos"}</button>
            {pose && <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-4 w-4 accent-clay" checked={guides} onChange={(e) => setGuides(e.target.checked)} />Repères d'alignement</label>}
          </div>
          <div className="flex flex-wrap gap-2"><button className="btn-clay" onClick={capture} disabled={!!frame}>📸 Capturer la comparaison et annoter</button></div>
          <Err msg={err} />
          {done && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">{done}</p>}
          {frame && <Annotator base={frame} onCancel={() => setFrame(null)} onSave={async (blob, note) => { await saveImage(v.id, blob, note); setFrame(null); setDone("Comparaison enregistrée ✓ : elle est dans « Images de l'analyse » de la première vidéo."); onChanged(); }} />}
        </>
      )}
    </section>
  );
}

// Lecteur du coach : ralenti, image par image, capture + dessin.
export function VideoStudio({ v, onChanged, cmpOpen, onToggleCompare }: { v: VideoDetail; onChanged: () => void; cmpOpen: boolean; onToggleCompare: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const gallery = useRef<HTMLElement>(null);
  // Suivi du squelette pendant la vidéo
  const [pose, setPose] = useState(false), [guides, setGuides] = useState(true);
  const [poseStatus, setPoseStatus] = useState<{ s: string; msg?: string }>({ s: "idle" });
  const poseSk = useRef<Skeleton | null>(null), [frameSk, setFrameSk] = useState<Skeleton | null>(null);
  useEffect(() => { if (vid.current) vid.current.playbackRate = speed; }, [speed]);
  const seek = (d: number) => { const el = vid.current; if (!el) return; el.pause(); el.currentTime = Math.max(0, Math.min(el.duration || 1e9, el.currentTime + d)); };

  function capture() {
    const el = vid.current; setErr("");
    if (!el || !el.videoWidth) return setErr("La vidéo n'est pas encore prête : attends qu'elle s'affiche, puis réessaie.");
    el.pause();
    const scale = Math.min(1, 960 / el.videoWidth), c = document.createElement("canvas");
    c.width = Math.round(el.videoWidth * scale); c.height = Math.round(el.videoHeight * scale);
    c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
    setFrameSk(pose && poseSk.current ? JSON.parse(JSON.stringify(poseSk.current)) : null); // le squelette suivi est repris tel quel : on peut encore le corriger
    setFrame(c);
  }
  async function save(blob: Blob, note: string) {
    await saveImage(v.id, blob, note);
    setFrame(null); setDone("Image enregistrée ✓ : elle est dans « Images de l'analyse » ci-dessous."); onChanged();
    setTimeout(() => gallery.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  }

  return (
    <div className="grid content-start gap-3">
      <div className="relative">
        <video ref={vid} controls playsInline preload="metadata" src={`/api/videos/${v.id}/file`} className="block max-h-[70vh] w-full rounded-xl bg-black" aria-label={`Vidéo : ${v.title}`} />
        <PoseOverlay video={vid} active={pose} guides={guides} onSkeleton={(s) => { poseSk.current = s; }} onStatus={(s, msg) => setPoseStatus({ s, msg })} />
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Commandes du lecteur">
        <button className="btn-outline btn-sm" onClick={() => seek(-1 / FPS)} aria-label="Reculer d'une image">◀ 1 image</button>
        <button className="btn-outline btn-sm" onClick={() => seek(1 / FPS)} aria-label="Avancer d'une image">1 image ▶</button>
        <button className="btn-outline btn-sm" onClick={() => seek(-1)}>−1 s</button>
        <button className="btn-outline btn-sm" onClick={() => seek(1)}>+1 s</button>
        {SPEEDS.map((s) => <button key={s} aria-pressed={speed === s} className={"btn btn-sm " + (speed === s ? "bg-ink text-white" : "border-2 border-line bg-white")} onClick={() => setSpeed(s)}>{s}×</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-clay btn-sm" onClick={() => { setDone(""); capture(); }} disabled={!!frame}>📸 Capturer l'image et annoter</button>
        <button className="btn-outline btn-sm" aria-expanded={cmpOpen} onClick={onToggleCompare}>{cmpOpen ? "Fermer la comparaison" : "Comparer avec une autre vidéo"}</button>
        <button className={"btn btn-sm " + (pose ? "bg-ink text-white" : "border-2 border-ink bg-white text-ink")} aria-pressed={pose} onClick={() => setPose((x) => !x)}>🦴 {pose ? "Arrêter le suivi du squelette" : "Suivre le squelette du joueur"}</button>
      </div>
      {pose && (
        <div className="grid gap-1 rounded-xl bg-sand p-3 text-sm" role="group" aria-label="Suivi du squelette">
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="h-4 w-4 accent-clay" checked={guides} onChange={(e) => setGuides(e.target.checked)} />Repères d'alignement (verticale et ligne tête–bassin–pieds)</label>
          <p role="status" className="m-0">{poseStatus.s === "loading" ? "⏳ Chargement du suivi automatique (la première fois, quelques secondes)…" : poseStatus.s === "error" ? `⚠️ Le suivi automatique n'a pas pu démarrer : ${poseStatus.msg ?? ""}. Tu peux quand même capturer une image et placer le squelette à la main.` : "✅ Le squelette suit le joueur : lis la vidéo, mets en pause ou avance image par image. Clique sur « Capturer » pour garder une image : tu pourras corriger les points et voir les mesures (angles, alignement)."}</p>
          <p className="hint m-0">Le calcul se fait sur cet appareil : la vidéo n'est envoyée nulle part. Si le joueur est flou ou caché, glisse les points à la main sur l'image capturée.</p>
        </div>
      )}
      <Err msg={err} />
      {frame && <Annotator base={frame} initialSkeleton={frameSk} onCancel={() => setFrame(null)} onSave={save} />}
      <section ref={gallery} className="grid gap-2" aria-label="Images de l'analyse">
        <h3 className="m-0 text-base">Images de l'analyse ({v.images.length}/8)</h3>
        {done && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">{done}</p>}
        {v.images.length === 0 ? <p className="hint m-0">Fige une image de la vidéo, dessine dessus (ligne, flèche, angle, texte…) puis enregistre-la : elle s'ajoute à l'analyse envoyée à l'élève.</p> : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {v.images.map((i) => (
              <li key={i.id} className="grid gap-1 rounded-xl border border-line bg-white p-2">
                <img src={`/api/videos/${v.id}/images/${i.id}`} alt={i.note || "Image annotée"} className="w-full rounded-lg" loading="lazy" />
                {i.note && <p className="m-0 text-sm">{i.note}</p>}
                <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer cette image ?")) { await del(`/videos/${v.id}/images/${i.id}`); onChanged(); } }}>Supprimer</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
