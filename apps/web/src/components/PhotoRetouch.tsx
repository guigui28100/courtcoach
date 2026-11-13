import { useEffect, useMemo, useRef, useState } from "react";

// Retouche simple d'UNE photo (luminosité, contraste, couleurs, zoom, déplacement, rotation, fond blanc).
// Tout se fait dans le navigateur (canvas) : rien n'est envoyé sur Internet. « Appliquer » renvoie une nouvelle image JPEG.
export type Retouch = { b: number; c: number; s: number; z: number; x: number; y: number; w: number; rot: number };
export const NO_RETOUCH: Retouch = { b: 0, c: 0, s: 0, z: 100, x: 0, y: 0, w: 0, rot: 0 };

function load(src: string): Promise<HTMLCanvasElement> {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 800 / Math.max(im.width, im.height)); const c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height); ok(c);
    };
    im.onerror = () => ko(new Error("Photo illisible"));
    im.src = src;
  });
}

export function renderRetouch(src: HTMLCanvasElement, t: Retouch, maxW: number): HTMLCanvasElement {
  const r = t.rot % 2 !== 0, w = r ? src.height : src.width, h = r ? src.width : src.height, k = Math.min(1, maxW / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d", { willReadFrequently: true })!, z = t.z / 100;
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.save(); x.translate(c.width / 2 - (t.x / 100) * c.width * (z - 1) / 2, c.height / 2 - (t.y / 100) * c.height * (z - 1) / 2);
  x.rotate((t.rot * Math.PI) / 2); x.scale(k * z, k * z); x.drawImage(src, -src.width / 2, -src.height / 2); x.restore();
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const b = t.b / 100, ct = 1 + t.c / 100, sa = 1 + t.s / 100, wh = t.w / 100;
  let bg = [255, 255, 255];
  if (wh > 0) { // couleur du fond = moyenne des quatre coins
    const sum = [0, 0, 0]; let cnt = 0;
    for (const [qx, qy] of [[2, 2], [c.width - 8, 2], [2, c.height - 8], [c.width - 8, c.height - 8]]) for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 6; xx++) { const j = ((qy + yy) * c.width + qx + xx) * 4; sum[0] += p[j]; sum[1] += p[j + 1]; sum[2] += p[j + 2]; cnt++; }
    bg = sum.map((v) => v / cnt);
  }
  const thr = wh * 110;
  for (let i = 0; i < p.length; i += 4) {
    let R = (p[i] - 128) * ct + 128 + b * 255, G = (p[i + 1] - 128) * ct + 128 + b * 255, B = (p[i + 2] - 128) * ct + 128 + b * 255;
    const L = 0.299 * R + 0.587 * G + 0.114 * B; R = L + (R - L) * sa; G = L + (G - L) * sa; B = L + (B - L) * sa;
    if (wh > 0) {
      const dr = p[i] - bg[0], dg = p[i + 1] - bg[1], db = p[i + 2] - bg[2], dist = Math.sqrt(dr * dr + dg * dg + db * db);
      const u = dist < thr * 0.55 ? 1 : dist < thr ? (thr - dist) / (thr * 0.45) : 0; R += (255 - R) * u; G += (255 - G) * u; B += (255 - B) * u;
    }
    p[i] = R < 0 ? 0 : R > 255 ? 255 : R; p[i + 1] = G < 0 ? 0 : G > 255 ? 255 : G; p[i + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
  }
  x.putImageData(d, 0, 0); return c;
}

const SL: { key: keyof Retouch; label: string; min: number; max: number }[] = [
  { key: "b", label: "Luminosité", min: -60, max: 60 }, { key: "c", label: "Contraste", min: -60, max: 60 }, { key: "s", label: "Couleurs (saturation)", min: -100, max: 100 },
  { key: "z", label: "Zoom", min: 100, max: 250 }, { key: "x", label: "Déplacer à gauche / à droite", min: -100, max: 100 }, { key: "y", label: "Déplacer vers le haut / le bas", min: -100, max: 100 },
  { key: "w", label: "Fond blanc (efface un fond gris ou coloré)", min: 0, max: 100 },
];

export function PhotoRetouch({ src, onApply, onClose }: { src: string; onApply: (url: string) => void; onClose: () => void }) {
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [t, setT] = useState<Retouch>(NO_RETOUCH);
  const [err, setErr] = useState("");
  const cv = useRef<HTMLCanvasElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { load(src).then(setBase).catch((e: Error) => setErr(e.message)); }, [src]);
  useEffect(() => { okBtn.current?.focus(); const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const view = useMemo(() => (base ? renderRetouch(base, t, 400) : null), [base, t]);
  useEffect(() => { const c = cv.current; if (!c || !view) return; c.width = view.width; c.height = view.height; c.getContext("2d")!.drawImage(view, 0, 0); }, [view]);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Retoucher la photo" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grid max-h-[calc(100dvh-2rem)] w-full max-w-3xl gap-4 overflow-auto rounded-xl bg-white p-4 text-ink md:grid-cols-2">
        <div><h3 className="m-0 mb-2 text-lg font-bold">Retoucher la photo</h3>
          <canvas ref={cv} className="block h-auto w-full rounded border border-line bg-white" aria-label="Aperçu de la photo retouchée" />
          <p className="m-0 mt-2 text-xs text-muted">La photo n'est modifiée que quand tu touches « Appliquer ». Tout reste dans ton navigateur.</p>{err && <p role="alert" className="text-sm font-bold text-red-700">{err}</p>}</div>
        <div className="grid content-start gap-2">
          {SL.map((s) => <label key={s.key} className="grid gap-0.5 text-sm font-bold">{s.label}<input type="range" min={s.min} max={s.max} value={t[s.key]} onChange={(e) => setT({ ...t, [s.key]: +e.target.value })} className="min-h-8 w-full" /></label>)}
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-outline btn-sm" onClick={() => setT({ ...t, rot: (t.rot + 3) % 4 })}>⟲ Tourner à gauche</button><button type="button" className="btn-outline btn-sm" onClick={() => setT({ ...t, rot: (t.rot + 1) % 4 })}>⟳ Tourner à droite</button></div>
          <div className="flex flex-wrap gap-2">
            <button ref={okBtn} type="button" className="btn-ink" disabled={!base} onClick={() => { if (base) { onApply(renderRetouch(base, t, 800).toDataURL("image/jpeg", 0.88)); onClose(); } }}>Appliquer</button>
            <button type="button" className="btn-outline" onClick={() => setT(NO_RETOUCH)}>Tout remettre</button>
            <button type="button" className="btn-outline" onClick={onClose}>Annuler</button>
          </div>
        </div>
      </div>
    </div>
  );
}
