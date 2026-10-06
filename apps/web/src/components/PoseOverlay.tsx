import { RefObject, useEffect, useRef, useState } from "react";
import { createLandmarker, drawSkeleton, Skeleton, smooth, toSkeleton } from "./skeleton";

// Squelette qui suit le joueur PENDANT la vidéo (lecture, pause, image par image).
// Se pose par-dessus la vidéo ; ne gêne pas les boutons du lecteur (pointer-events: none).
export function PoseOverlay({ video, active, guides, labels = false, onSkeleton, onStatus }: {
  video: RefObject<HTMLVideoElement | null>; active: boolean; guides: boolean; labels?: boolean;
  onSkeleton?: (s: Skeleton | null) => void; onStatus?: (s: "idle" | "loading" | "ready" | "error", msg?: string) => void;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ guides, labels }); opts.current = { guides, labels };
  const last = useRef<Skeleton | null>(null);
  const [, redraw] = useState(0);

  // Dessine le dernier squelette connu (sans nouvelle détection) : utile quand la fenêtre change de taille ou qu'on active les repères
  const paint = () => {
    const c = cv.current, v = video.current; if (!c || !v) return;
    const dpr = window.devicePixelRatio || 1, W = v.clientWidth, H = v.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d")!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const sk = last.current; if (!sk || !v.videoWidth) return;
    // La vidéo est centrée dans son cadre (bandes noires éventuelles) : on retrouve le rectangle réellement occupé par l'image
    const k = Math.min(W / v.videoWidth, H / v.videoHeight), cw = v.videoWidth * k, ch = v.videoHeight * k;
    drawSkeleton(g, sk, (W - cw) / 2, (H - ch) / 2, cw, ch, opts.current);
  };

  useEffect(() => { paint(); }); // à chaque affichage (repères activés / désactivés)

  useEffect(() => {
    const v = video.current; if (!active || !v) { last.current = null; onSkeleton?.(null); paint(); onStatus?.("idle"); return; }
    let stop = false, lm: Awaited<ReturnType<typeof createLandmarker>> | null = null, lastTs = 0, handle = 0, busy = false;
    onStatus?.("loading");
    const detect = () => {
      if (!lm || busy || v.readyState < 2 || !v.videoWidth) return;
      busy = true;
      try {
        const ts = Math.max(performance.now(), lastTs + 1); lastTs = ts;
        const sk = toSkeleton(lm.detectForVideo(v, ts));
        last.current = sk ? smooth(last.current, sk) : last.current;
        onSkeleton?.(last.current); paint();
      } catch (e) { onStatus?.("error", (e as Error).message); } finally { busy = false; }
    };
    const loop = () => {
      if (stop) return; detect();
      const anyV = v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
      if (anyV.requestVideoFrameCallback) handle = anyV.requestVideoFrameCallback(loop); else handle = requestAnimationFrame(loop);
    };
    const onSeek = () => { last.current = null; detect(); };
    createLandmarker("VIDEO").then((m) => {
      if (stop) { m.close(); return; }
      lm = m; onStatus?.("ready"); detect(); loop();
      v.addEventListener("seeked", onSeek); v.addEventListener("pause", detect); v.addEventListener("loadeddata", onSeek);
    }).catch((e) => onStatus?.("error", (e as Error).message || "Le suivi automatique n'a pas pu démarrer."));
    const onResize = () => { paint(); redraw((n) => n + 1); };
    window.addEventListener("resize", onResize);
    return () => {
      stop = true; window.removeEventListener("resize", onResize);
      v.removeEventListener("seeked", onSeek); v.removeEventListener("pause", detect); v.removeEventListener("loadeddata", onSeek);
      const anyV = v as HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void };
      if (anyV.cancelVideoFrameCallback) anyV.cancelVideoFrameCallback(handle); else cancelAnimationFrame(handle);
      try { lm?.close(); } catch { /* déjà fermé */ }
      last.current = null; paint();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={cv} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-full" />;
}
