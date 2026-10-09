import { PointerEvent, useEffect, useRef, useState } from "react";
import { del, get, put } from "../api";
import { Err } from "./ui";

// Signature du coach : on la dessine une fois (souris ou doigt), elle s'affiche ensuite en bas de tous les bulletins.
export function SignaturePad() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { get<{ signature: string | null }>("/signature").then((r) => setSaved(r.signature)).catch(() => setSaved(null)); }, []);
  useEffect(() => {
    const c = canvas.current; if (!c) return; const g = c.getContext("2d"); if (!g) return;
    g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#10203a";
  }, [saved]);
  const pos = (e: PointerEvent<HTMLCanvasElement>) => { const c = canvas.current!; const r = c.getBoundingClientRect(); return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height]; };
  function down(e: PointerEvent<HTMLCanvasElement>) { const g = canvas.current!.getContext("2d")!; const [x, y] = pos(e); drawing.current = true; canvas.current!.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.1, y + 0.1); g.stroke(); setTouched(true); }
  function move(e: PointerEvent<HTMLCanvasElement>) { if (!drawing.current) return; const g = canvas.current!.getContext("2d")!; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); }
  const up = () => { drawing.current = false; };
  function clear() { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setTouched(false); }
  async function save() {
    setErr(""); setBusy(true);
    try { const image = canvas.current!.toDataURL("image/png"); await put("/signature", { image }); setSaved(image); clear(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function remove() { setErr(""); setBusy(true); try { await del("/signature"); setSaved(null); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }
  return (
    <section className="card grid gap-3" aria-labelledby="s-sign">
      <h2 id="s-sign" className="m-0">✍️ Ma signature sur les bulletins</h2>
      <p className="hint m-0">Dessine ta signature une seule fois (à la souris ou au doigt). Elle apparaît ensuite en bas de tous les bulletins, à côté de « Signature du coach ».</p>
      {saved && <div className="grid gap-1"><strong>Signature enregistrée :</strong><img src={saved} alt="Ta signature enregistrée" className="h-20 w-auto max-w-full justify-self-start rounded-xl border-2 border-line bg-white p-2" /></div>}
      <canvas ref={canvas} width={500} height={160} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Zone pour dessiner ta signature" className="h-auto w-full max-w-lg touch-none rounded-xl border-2 border-dashed border-line bg-white" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-clay" disabled={!touched || busy} onClick={save}>{saved ? "Remplacer ma signature" : "Enregistrer ma signature"}</button>
        <button type="button" className="btn-outline" disabled={!touched} onClick={clear}>Effacer le dessin</button>
        {saved && <button type="button" className="btn-danger btn-sm" disabled={busy} onClick={remove}>Supprimer ma signature</button>}
      </div>
      <Err msg={err} />
    </section>
  );
}
