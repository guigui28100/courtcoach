import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, del } from "../api";
import { Err } from "./ui";
import { useVideos } from "./Videos";
import { VideoDetail } from "../types";

type Pt = [number, number];
type Tool = "line" | "arrow" | "circle" | "free" | "angle";
interface Shape { tool: Tool; color: string; pts: Pt[]; }
const COLORS: [string, string][] = [["#e11d48", "Rouge"], ["#facc15", "Jaune"], ["#38bdf8", "Bleu"], ["#ffffff", "Blanc"]];
const TOOLS: [Tool, string][] = [["line", "Ligne"], ["arrow", "Flèche"], ["circle", "Cercle"], ["free", "Trait libre"], ["angle", "Angle (3 points)"]];
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

function drawShape(g: CanvasRenderingContext2D, s: Shape, w: number) {
  const lw = Math.max(3, w / 220);
  g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = lw; g.lineCap = "round"; g.lineJoin = "round";
  const [a, b, c] = s.pts;
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
function Annotator({ base, onCancel, onSave }: { base: HTMLCanvasElement; onCancel: () => void; onSave: (blob: Blob, note: string) => Promise<void> }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0][0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, []); // l'éditeur apparaît à l'écran dès la capture
  const W = base.width, H = base.height;

  const paint = useCallback((target: HTMLCanvasElement, list: Shape[]) => {
    const g = target.getContext("2d")!;
    g.clearRect(0, 0, W, H); g.drawImage(base, 0, 0);
    list.forEach((s) => drawShape(g, s, W));
  }, [base, W, H]);
  useEffect(() => { if (cv.current) paint(cv.current, draft ? [...shapes, draft] : shapes); }, [shapes, draft, paint]);

  const at = (e: PointerEvent<HTMLCanvasElement>): Pt => { const r = cv.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  function down(e: PointerEvent<HTMLCanvasElement>) {
    e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId);
    const p = at(e);
    if (tool === "angle") {
      if (draft && draft.tool === "angle" && draft.pts.length < 3) { const next = { ...draft, pts: [...draft.pts, p] }; if (next.pts.length === 3) { setShapes((l) => [...l, next]); setDraft(null); } else setDraft(next); }
      else setDraft({ tool, color, pts: [p] });
      return;
    }
    setDraft({ tool, color, pts: tool === "free" ? [p] : [p, p] });
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    const p = at(e);
    if (draft.tool === "free") setDraft({ ...draft, pts: [...draft.pts, p] });
    else if (draft.tool === "angle") return;
    else if (e.buttons) setDraft({ ...draft, pts: [draft.pts[0], p] });
  }
  function up() {
    if (!draft || draft.tool === "angle") return;
    const moved = draft.tool === "free" ? draft.pts.length > 2 : Math.hypot(draft.pts[1][0] - draft.pts[0][0], draft.pts[1][1] - draft.pts[0][1]) > 4;
    if (moved) setShapes((l) => [...l, draft]);
    setDraft(null);
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
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Couleur">
        {COLORS.map(([c, label]) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={label} onClick={() => setColor(c)} className={"h-9 w-9 rounded-full border-2 " + (color === c ? "border-ink ring-2 ring-ink" : "border-line")} style={{ background: c }} />)}
        <button type="button" className="btn-outline btn-sm" disabled={!shapes.length} onClick={() => setShapes((l) => l.slice(0, -1))}>Annuler le dernier tracé</button>
        <button type="button" className="btn-outline btn-sm" disabled={!shapes.length && !draft} onClick={() => { setShapes([]); setDraft(null); }}>Tout effacer</button>
      </div>
      {tool === "angle" && <p className="hint m-0">{pending === null ? "Clique 3 points : le début d'un segment, le sommet de l'angle (l'articulation), puis la fin du second segment. L'angle s'affiche en degrés." : `Encore ${pending} point${pending > 1 ? "s" : ""} à cliquer.`}</p>}
      <canvas ref={cv} width={W} height={H} role="img" aria-label="Image de la vidéo à annoter, avec les tracés du coach" className="w-full touch-none rounded-xl bg-black" style={{ cursor: "crosshair", maxHeight: "70vh", objectFit: "contain" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDraft(null)} />
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

// Comparaison côte à côte de deux vidéos (du même élève), avec des commandes communes.
function Compare({ v, onClose }: { v: VideoDetail; onClose: () => void }) {
  const all = useVideos() ?? [];
  const options = all.filter((o) => o.id !== v.id && o.kind === v.kind && (v.kind === "centre" ? o.player?.id === v.player?.id : o.owner?.id === v.owner?.id));
  const [otherId, setOtherId] = useState("");
  const a = useRef<HTMLVideoElement>(null), b = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState(0), [speed, setSpeed] = useState(1), [playing, setPlaying] = useState(false);
  const both = (f: (el: HTMLVideoElement) => void) => [a.current, b.current].forEach((el) => el && f(el));
  const seekRatio = (r: number) => { both((el) => { if (el.duration && isFinite(el.duration)) el.currentTime = r * el.duration; }); setPos(r); };
  const step = (n: number) => { both((el) => { el.pause(); el.currentTime = Math.max(0, el.currentTime + n / FPS); }); setPlaying(false); };
  useEffect(() => { both((el) => { el.playbackRate = speed; }); }, [speed, otherId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card grid gap-3" aria-label="Comparer deux vidéos">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="m-0">Comparer avec une autre vidéo</h3><button className="btn-outline btn-sm" onClick={onClose}>Fermer la comparaison</button></div>
      {options.length === 0 ? <p className="hint m-0">Il n'y a pas d'autre vidéo de {v.kind === "centre" ? "ce joueur" : "cet adhérent"} à comparer.</p> : (
        <div className="field"><label htmlFor="cmp">Deuxième vidéo</label><select id="cmp" className="input" value={otherId} onChange={(e) => { setOtherId(e.target.value); setPlaying(false); setPos(0); }}><option value="">Choisir…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.shot})</option>)}</select></div>
      )}
      {otherId && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <video ref={a} src={`/api/videos/${v.id}/file`} playsInline preload="metadata" muted className="w-full rounded-xl bg-black" aria-label={`Vidéo 1 : ${v.title}`} onTimeUpdate={(e) => { const el = e.currentTarget; if (el.duration) setPos(el.currentTime / el.duration); }} />
            <video ref={b} src={`/api/videos/${otherId}/file`} playsInline preload="metadata" muted className="w-full rounded-xl bg-black" aria-label="Vidéo 2" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-clay btn-sm" onClick={() => { if (playing) both((el) => el.pause()); else both((el) => { void el.play(); }); setPlaying(!playing); }}>{playing ? "Pause" : "Lecture"}</button>
            <button className="btn-outline btn-sm" onClick={() => step(-1)} aria-label="Reculer d'une image">◀ 1 image</button>
            <button className="btn-outline btn-sm" onClick={() => step(1)} aria-label="Avancer d'une image">1 image ▶</button>
            {SPEEDS.map((s) => <button key={s} aria-pressed={speed === s} className={"btn btn-sm " + (speed === s ? "bg-ink text-white" : "border-2 border-line bg-white")} onClick={() => setSpeed(s)}>{s}×</button>)}
          </div>
          <label className="flex items-center gap-3 text-sm font-bold">Position<input type="range" min={0} max={1000} value={Math.round(pos * 1000)} className="flex-1 accent-clay" onChange={(e) => seekRatio(Number(e.target.value) / 1000)} aria-label="Position dans les deux vidéos" /></label>
          <p className="hint m-0">Les deux vidéos avancent ensemble, proportionnellement à leur durée. Les vidéos sont muettes dans la comparaison.</p>
        </>
      )}
    </section>
  );
}

// Lecteur du coach : ralenti, image par image, capture + dessin, comparaison.
export function VideoStudio({ v, onChanged }: { v: VideoDetail; onChanged: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState<HTMLCanvasElement | null>(null);
  const [cmp, setCmp] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const gallery = useRef<HTMLElement>(null);
  useEffect(() => { if (vid.current) vid.current.playbackRate = speed; }, [speed]);
  const seek = (d: number) => { const el = vid.current; if (!el) return; el.pause(); el.currentTime = Math.max(0, Math.min(el.duration || 1e9, el.currentTime + d)); };

  function capture() {
    const el = vid.current; setErr("");
    if (!el || !el.videoWidth) return setErr("La vidéo n'est pas encore prête : attends qu'elle s'affiche, puis réessaie.");
    el.pause();
    const scale = Math.min(1, 960 / el.videoWidth), c = document.createElement("canvas");
    c.width = Math.round(el.videoWidth * scale); c.height = Math.round(el.videoHeight * scale);
    c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
    setFrame(c);
  }
  async function save(blob: Blob, note: string) {
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 30000);
    try { await api(`/videos/${v.id}/images?note=${encodeURIComponent(note)}`, { method: "POST", body: blob, headers: { "Content-Type": "application/octet-stream" }, signal: stop.signal }); }
    finally { clearTimeout(timer); }
    setFrame(null); setDone("Image enregistrée ✓ : elle est dans « Images de l'analyse » ci-dessous."); onChanged();
    setTimeout(() => gallery.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  }
  const kb = useMemo(() => v.images.length, [v.images]);

  return (
    <div className="grid content-start gap-3">
      <video ref={vid} controls playsInline preload="metadata" src={`/api/videos/${v.id}/file`} className="max-h-[70vh] w-full rounded-xl bg-black" aria-label={`Vidéo : ${v.title}`} />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Commandes du lecteur">
        <button className="btn-outline btn-sm" onClick={() => seek(-1 / FPS)} aria-label="Reculer d'une image">◀ 1 image</button>
        <button className="btn-outline btn-sm" onClick={() => seek(1 / FPS)} aria-label="Avancer d'une image">1 image ▶</button>
        <button className="btn-outline btn-sm" onClick={() => seek(-1)}>−1 s</button>
        <button className="btn-outline btn-sm" onClick={() => seek(1)}>+1 s</button>
        {SPEEDS.map((s) => <button key={s} aria-pressed={speed === s} className={"btn btn-sm " + (speed === s ? "bg-ink text-white" : "border-2 border-line bg-white")} onClick={() => setSpeed(s)}>{s}×</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-clay btn-sm" onClick={() => { setDone(""); capture(); }} disabled={!!frame}>📸 Capturer l'image et annoter</button>
        <button className="btn-outline btn-sm" aria-expanded={cmp} onClick={() => setCmp(!cmp)}>Comparer avec une autre vidéo</button>
      </div>
      <Err msg={err} />
      {frame && <Annotator base={frame} onCancel={() => setFrame(null)} onSave={save} />}
      {cmp && <Compare v={v} onClose={() => setCmp(false)} />}
      <section ref={gallery} className="grid gap-2" aria-label="Images de l'analyse">
        <h3 className="m-0 text-base">Images de l'analyse ({kb}/8)</h3>
        {done && <p role="status" className="m-0 rounded-xl border-2 border-ok bg-[#eef8f1] p-3 font-bold">{done}</p>}
        {v.images.length === 0 ? <p className="hint m-0">Fige une image de la vidéo, dessine dessus (ligne, flèche, angle…) puis enregistre-la : elle s'ajoute à l'analyse envoyée à l'élève.</p> : (
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
