import { useEffect, useRef, useState } from "react";
import { api, del } from "../api";
import type { VideoRow } from "../types";
import { Err } from "./ui";

const MAX_SECONDS = 180; // 3 minutes : largement assez pour un commentaire, et bien sous la limite de 2 Mo
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Lecture du commentaire audio du coach (élève, famille, adulte) : la vidéo contient le son, ici c'est la voix du coach.
export function AudioPlayer({ v }: { v: Pick<VideoRow, "id" | "audio"> }) {
  if (!v.audio) return null;
  return (
    <section className="grid gap-1 rounded-xl border-2 border-clay/40 bg-[#fff6ef] p-3" aria-label="Commentaire audio du coach">
      <strong>🎙️ Le coach t'a laissé un commentaire audio{v.audio.seconds ? ` (${fmt(v.audio.seconds)})` : ""}</strong>
      <audio controls preload="none" src={`/api/videos/${v.id}/audio`} className="w-full" aria-label="Écouter le commentaire audio du coach" />
    </section>
  );
}

// Enregistrement du commentaire audio par le coach (micro de l'appareil, rien n'est envoyé avant « Joindre »).
export function AudioRecorder({ v, onChanged }: { v: VideoRow; onChanged: () => void }) {
  const [phase, setPhase] = useState<"idle" | "rec" | "review">("idle");
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const rec = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const parts = useRef<Blob[]>([]); const timer = useRef<number>(0);
  const supported = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  useEffect(() => () => { window.clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function start() {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.current = s;
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 }); rec.current = r; parts.current = [];
      r.ondataavailable = (e) => { if (e.data.size) parts.current.push(e.data); };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop()); window.clearInterval(timer.current);
        const b = new Blob(parts.current, { type: r.mimeType || type || "audio/webm" }); setBlob(b); setUrl(URL.createObjectURL(b)); setPhase("review");
      };
      r.start(); setSecs(0); setPhase("rec");
      const t0 = Date.now(); timer.current = window.setInterval(() => { const n = Math.floor((Date.now() - t0) / 1000); setSecs(n); if (n >= MAX_SECONDS) r.state === "recording" && r.stop(); }, 250);
    } catch { setErr("Impossible d'utiliser le micro. Autorise-le dans ton navigateur (cadenas à côté de l'adresse), puis réessaie."); }
  }
  const stop = () => { if (rec.current?.state === "recording") rec.current.stop(); };
  function again() { setBlob(null); setUrl(""); setPhase("idle"); setSecs(0); }
  async function attach() {
    if (!blob) return; setErr(""); setBusy(true);
    try { await api(`/videos/${v.id}/audio?seconds=${secs}`, { method: "PUT", body: blob, headers: { "Content-Type": "application/octet-stream" } }); again(); onChanged(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="grid gap-2" aria-label="Commentaire audio">
      <h3 className="m-0 text-base">🎙️ Commentaire audio</h3>
      {v.audio && phase === "idle" && (
        <div className="grid gap-2 rounded-xl border border-line bg-white p-2">
          <audio controls preload="none" src={`/api/videos/${v.id}/audio`} className="w-full" aria-label="Commentaire audio enregistré" />
          <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer ce commentaire audio ?")) { try { await del(`/videos/${v.id}/audio`); onChanged(); } catch (x) { setErr((x as Error).message); } } }}>Supprimer l'audio</button>
        </div>
      )}
      {!supported && <p className="hint m-0">Ce navigateur ne permet pas d'enregistrer la voix. Essaie avec Chrome, Edge, Firefox ou Safari récent.</p>}
      {supported && phase === "idle" && <div><button className="btn-clay btn-sm" onClick={start}>{v.audio ? "🎙️ Refaire l'enregistrement" : "🎙️ Enregistrer ma voix"}</button><p className="hint m-0 mt-1">Jusqu'à 3 minutes. L'élève l'entendra avec ton analyse (ou tout de suite si la vidéo vient de toi). Rien n'est envoyé tant que tu n'as pas cliqué sur « Joindre ».</p></div>}
      {phase === "rec" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-clay bg-[#fff6ef] p-3" role="status">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-danger" aria-hidden="true" /><strong>Enregistrement… {fmt(secs)}</strong>
          <button className="btn-ink btn-sm" onClick={stop}>⏹️ Arrêter</button>
        </div>
      )}
      {phase === "review" && (
        <div className="grid gap-2 rounded-xl border border-line bg-white p-3">
          <p className="m-0 font-bold">Écoute avant d'envoyer ({fmt(secs)}) :</p>
          <audio controls src={url} className="w-full" aria-label="Écouter ton enregistrement" />
          <div className="flex flex-wrap gap-2"><button className="btn-clay btn-sm" disabled={busy} onClick={attach}>✅ Joindre à l'analyse</button><button className="btn-outline btn-sm" disabled={busy} onClick={again}>Recommencer</button></div>
        </div>
      )}
      <Err msg={err} />
    </section>
  );
}
