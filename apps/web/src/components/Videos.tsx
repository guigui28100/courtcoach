import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, del, get, post } from "../api";
import { Err, Field } from "./ui";
import { fmtDate, fmtMo, MAX_VIDEO_BYTES, SHOTS, VideoDetail, VideoRow } from "../types";

export function useVideos(version = 0) {
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  useEffect(() => { get<VideoRow[]>("/videos").then(setVideos).catch(() => setVideos([])); }, [version]);
  return videos;
}

// Envoi d'une vidéo, morceau par morceau (2 Mo), avec barre de progression.
export function VideoUpload({ playerId, onDone, who }: { playerId?: string; onDone: () => void; who?: string }) {
  const [err, setErr] = useState("");
  const [pct, setPct] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const blob = file.current?.files?.[0];
    setErr("");
    if (!blob) return setErr("Choisis une vidéo.");
    if (blob.size > MAX_VIDEO_BYTES) return setErr(`Cette vidéo pèse ${fmtMo(blob.size)} : le maximum est ${fmtMo(MAX_VIDEO_BYTES)}. Filme quelques coups seulement (10 à 30 secondes).`);
    if (blob.size < 1024) return setErr("Ce fichier est vide.");
    setPct(0);
    try {
      const c = await post<{ id: string; chunkSize: number; chunkCount: number }>("/videos", { title: String(f.get("title")), shot: String(f.get("shot")), question: String(f.get("question") || "") || undefined, sizeBytes: blob.size, playerId });
      for (let i = 0; i < c.chunkCount; i++) {
        const part = blob.slice(i * c.chunkSize, (i + 1) * c.chunkSize);
        for (let attempt = 1; ; attempt++) {
          try { await api(`/videos/${c.id}/chunks/${i}`, { method: "PUT", body: part, headers: { "Content-Type": "application/octet-stream" } }); break; }
          catch (x) { if (attempt >= 3) { await del(`/videos/${c.id}`).catch(() => undefined); throw x; } }
        }
        setPct(Math.round(((i + 1) / c.chunkCount) * 100));
      }
      await post(`/videos/${c.id}/complete`);
      form.reset(); setOpen(false); onDone();
    } catch (x) { setErr((x as Error).message); }
    setPct(null);
  }

  return (
    <div className="grid gap-3">
      <button type="button" className="btn-clay self-start" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Masquer le formulaire" : "+ Envoyer une vidéo"}</button>
      {open && (
        <form onSubmit={send} className="grid gap-4" noValidate>
          <p className="alert m-0">Filme quelques coups (10 à 30 secondes, {fmtMo(MAX_VIDEO_BYTES)} maximum). Pas de nom ni de numéro de téléphone dans le titre. {playerId ? "La vidéo n'est visible que par le coach et la famille du joueur ; elle est supprimée automatiquement après 12 mois." : "La vidéo n'est visible que par toi et le coach ; elle est supprimée automatiquement après 12 mois."}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre" id="v-title"><input id="v-title" name="title" required maxLength={80} className="input" placeholder="Mon service de ce matin" /></Field>
            <Field label="Coup à analyser" id="v-shot"><select id="v-shot" name="shot" className="input">{SHOTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <Field label={who ? `Une question pour le coach ? (facultatif)` : "Une question pour le coach ? (facultatif)"} id="v-q"><textarea id="v-q" name="question" maxLength={500} className="input" /></Field>
          <Field label="Fichier vidéo (MP4, MOV ou WebM)" id="v-file"><input id="v-file" ref={file} type="file" accept="video/mp4,video/quicktime,video/webm" className="input !py-2.5" /></Field>
          <Err msg={err} />
          {pct !== null && <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Envoi en cours" className="h-3 overflow-hidden rounded-full bg-sand"><div className="h-full bg-clay transition-[width]" style={{ width: `${pct}%` }} /></div>}
          <button className="btn-clay self-start" disabled={pct !== null}>{pct !== null ? `Envoi… ${pct} %` : "Envoyer la vidéo"}</button>
        </form>
      )}
    </div>
  );
}

export const VideoBadge = ({ v }: { v: VideoRow }) => v.analysis?.sentAt
  ? <span className={"badge " + (v.seenAt ? "" : "!border-ok !bg-[#e6f5ec] !text-ok")}>{v.seenAt ? "Analyse lue" : "✅ Analyse reçue"}</span>
  : <span className="badge !border-[#c08a00] !bg-[#fff3cd] !text-[#7a5a00]">En attente d'analyse</span>;

// Lecteur + analyse + discussion d'une vidéo, vus par l'adhérent ou la famille (lecture seule + discussion).
export function VideoPanel({ id, onChanged, onSeen }: { id: string; onChanged: () => void; onSeen?: () => void }) {
  const [v, setV] = useState<VideoDetail | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => { get<VideoDetail>(`/videos/${id}`).then(setV).catch(() => setV(null)); }, [id]);
  useEffect(load, [load]);
  useEffect(() => { if (v?.analysis?.sentAt && !v.seenAt) post(`/videos/${id}/seen`).then(() => { load(); onSeen?.(); }).catch(() => undefined); }, [v?.analysis?.sentAt, v?.seenAt, id, load, onSeen]);
  if (!v) return <p className="text-muted">Chargement…</p>;
  async function say(e: FormEvent) {
    e.preventDefault(); setErr("");
    try { await post(`/videos/${id}/messages`, { text }); setText(""); load(); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <div className="grid gap-3">
      <video controls playsInline preload="metadata" src={`/api/videos/${id}/file`} className="max-h-[70vh] w-full rounded-xl bg-black" aria-label={`Vidéo : ${v.title}`} />
      {v.question && <p className="m-0"><strong>Ta question :</strong> {v.question}</p>}
      {v.analysis?.sentAt ? <Analysis v={v} /> : <p className="m-0 rounded-xl bg-sand p-3">Le coach n'a pas encore analysé cette vidéo. Tu seras prévenu ici dès que ce sera fait.</p>}
      {v.analysis?.sentAt && (
        <section className="grid gap-2" aria-label="Discussion avec le coach">
          <h4 className="m-0 font-display font-bold">Discussion avec le coach</h4>
          <Thread messages={v.messages} />
          <form onSubmit={say} className="flex flex-wrap gap-2" noValidate>
            <input className="input min-w-52 flex-1" aria-label="Ton message" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Une précision, une question…" />
            <button className="btn-clay btn-sm" disabled={!text.trim()}>Envoyer</button>
          </form>
          <Err msg={err} />
        </section>
      )}
      <p className="hint m-0">Supprimée automatiquement le {v.deleteAfter ? fmtDate(v.deleteAfter) : "—"}.</p>
      <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer définitivement cette vidéo ?")) { await del(`/videos/${id}`); onChanged(); } }}>Supprimer la vidéo</button>
    </div>
  );
}

export function Analysis({ v }: { v: VideoDetail }) {
  const a = v.analysis!;
  return (
    <section className="grid gap-2 rounded-xl border border-line bg-[#fffaf5] p-3" aria-label="Analyse du coach">
      <h4 className="m-0 font-display font-bold">Analyse du coach · {a.sentAt && fmtDate(a.sentAt)}</h4>
      {a.observation && <p className="m-0 whitespace-pre-line">{a.observation}</p>}
      {a.strengths && <p className="m-0"><strong>Points forts : </strong>{a.strengths}</p>}
      {a.improve && <p className="m-0"><strong>À améliorer : </strong>{a.improve}</p>}
      {v.linkedGoals.length > 0 && <p className="m-0"><strong>Objectifs travaillés : </strong>{v.linkedGoals.map((g) => g.title).join(" ; ")}</p>}
      {v.images.length > 0 && (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2" aria-label="Images annotées par le coach">
          {v.images.map((i) => <li key={i.id} className="grid gap-1"><img src={`/api/videos/${v.id}/images/${i.id}`} alt={i.note || "Image annotée par le coach"} className="w-full rounded-lg" loading="lazy" />{i.note && <small>{i.note}</small>}</li>)}
        </ul>
      )}
      {a.exercises.length > 0 && <div><strong>Exercices proposés :</strong><ul className="m-0 mt-1 pl-5">{a.exercises.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
    </section>
  );
}

export function Thread({ messages }: { messages: VideoDetail["messages"] }) {
  if (!messages.length) return <p className="hint m-0">Aucun message pour l'instant.</p>;
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {messages.map((m) => (
        <li key={m.id} className={"max-w-[85%] rounded-2xl px-3 py-2 " + (m.mine ? "justify-self-end bg-[#fdf1ea]" : "justify-self-start bg-sand")}>
          <small className="block font-bold">{m.fromCoach ? "Coach" : m.mine ? "Moi" : "Famille"} · {fmtDate(m.createdAt)}</small>{m.text}
        </li>
      ))}
    </ul>
  );
}

// Liste de vidéos ouvrables (une à la fois)
export function VideoList({ videos, onChanged, empty }: { videos: VideoRow[]; onChanged: () => void; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!videos.length) return <p className="m-0 text-muted">{empty}</p>;
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {videos.map((v) => (
        <li key={v.id} className="rounded-xl border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><strong>{v.title}</strong><p className="m-0 text-sm text-muted">{v.shot} · {fmtDate(v.recordedAt)} · {fmtMo(v.sizeBytes)}</p></div>
            <div className="flex items-center gap-2"><VideoBadge v={v} /><button className="btn-outline btn-sm" aria-expanded={open === v.id} onClick={() => setOpen(open === v.id ? null : v.id)}>{open === v.id ? "Fermer" : "Ouvrir"}</button></div>
          </div>
          {open === v.id && <div className="mt-3"><VideoPanel id={v.id} onChanged={() => { setOpen(null); onChanged(); }} onSeen={onChanged} /></div>}
        </li>
      ))}
    </ul>
  );
}
