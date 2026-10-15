import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { del, get, post, put } from "../api";
import { AuthorBadge, BackLink, Empty, Err, Field, Page, PageHead, Skeleton } from "../components/ui";
import { Compare, VideoStudio } from "../components/Studio";
import { Thread } from "../components/Videos";
import { adultFacts, adultName, AXES, fmtDate, fmtMo, VideoDetail } from "../types";

// Page du coach : regarder une vidéo, écrire l'analyse, l'envoyer, discuter.
export default function VideoReview() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [v, setV] = useState<VideoDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [exercises, setExercises] = useState<string[]>([]);
  const [goalIds, setGoalIds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [bien, setBien] = useState(""), [travaille, setTravaille] = useState(""), [mot, setMot] = useState(""); // analyse simple (Centre)
  const [cmp, setCmp] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const load = useCallback(() => {
    get<VideoDetail>(`/videos/${id}`).then((d) => { setV(d); setBien(d.analysis?.strengths ?? ""); setTravaille(d.analysis?.improve ?? ""); setMot(d.analysis?.observation ?? ""); setExercises(d.analysis?.exercises ?? []); setGoalIds(d.goalIds ?? d.analysis?.goalIds ?? []); }).catch(() => setMissing(true));
  }, [id]);
  useEffect(load, [load]);
  if (missing) return <Page><Empty>Cette vidéo est introuvable (elle a peut-être été supprimée).</Empty><Link to="/coach/adultes?onglet=videos" className="btn-clay no-underline">Retour</Link></Page>;
  if (!v) return <Skeleton lines={2} />;
  const centre = v.kind === "centre";
  const sent = !!v.analysis?.sentAt;
  const draft = !!v.draft; // vidéo déposée par le coach : le joueur ne la voit pas encore
  async function sendVideo() {
    setMsg(null);
    try { await post(`/videos/${id}/send-to-player`); setMsg({ ok: true, text: `Vidéo envoyée à ${v!.player?.firstName ?? "le joueur"} ✓` }); load(); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }

  // Rattacher / détacher une mission : enregistré tout de suite (le joueur retrouve la vidéo en cliquant sur la mission)
  async function toggleGoal(gid: string, on: boolean) {
    const next = on ? [...goalIds, gid] : goalIds.filter((x) => x !== gid);
    setGoalIds(next); setMsg(null);
    try { await put(`/videos/${id}/goals`, { goalIds: next }); } catch (x) { setGoalIds(goalIds); setMsg({ ok: false, text: (x as Error).message }); }
  }

  async function save(thenSend: boolean) {
    const f = formRef.current ? new FormData(formRef.current) : new FormData();
    setMsg(null);
    if (centre && thenSend && !(bien.trim() && travaille.trim()) && !mot.trim()) { setMsg({ ok: false, text: "Écris « Ce qui est bien » et « Ce qu'on travaille » avant d'envoyer." }); return; }
    try {
      await put(`/videos/${id}/analysis`, centre ? { observation: mot, strengths: bien, improve: travaille, goalIds } : { observation: String(f.get("observation") || ""), strengths: String(f.get("strengths") || ""), improve: String(f.get("improve") || ""), exercises: exercises.filter((x) => x.trim()) });
      if (thenSend) await post(`/videos/${id}/analysis/send`);
      setMsg({ ok: true, text: thenSend ? (sent ? "Analyse mise à jour ✓" : draft ? "Vidéo et analyse envoyées ✓ : le joueur les voit dans son espace." : "Analyse envoyée ✓ : l'élève est prévenu dans son espace.") : "Brouillon enregistré ✓" }); load();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  async function say(e: FormEvent) { e.preventDefault(); await post(`/videos/${id}/messages`, { text }); setText(""); load(); }

  const who = centre ? `${v.player?.firstName} · Centre de compétition jeunes` : `${adultName(v.owner)}${adultFacts(v.owner) ? " · " + adultFacts(v.owner) : ""}${v.owner?.phone ? " · 📞 " + v.owner.phone : ""} · Demande de coaching`;
  return (
    <>
      <PageHead eyebrow={centre ? "Centre de compétition jeunes" : "Demandes de coaching"} title={v.title}>{who} · {v.shot} · {fmtDate(v.recordedAt)} · {fmtMo(v.sizeBytes)}</PageHead>
      <Page>
        <BackLink fallback={centre && v.player ? `/coach/centre/${v.player.id}?onglet=videos` : "/coach/adultes?onglet=videos"} className="font-bold text-ink underline">← Retour</BackLink>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            {draft && (
              <div className="alert grid gap-2" role="status">
                <strong>📝 Brouillon : {v.player?.firstName} et sa famille ne voient pas encore cette vidéo.</strong>
                <span>Prends ton temps : commente-la dans le studio, puis envoie-la. Tu peux aussi l'envoyer telle quelle.</span>
                <button type="button" className="btn-clay btn-sm self-start" onClick={sendVideo}>📤 Envoyer la vidéo à {v.player?.firstName}</button>
              </div>
            )}
            <VideoStudio v={v} onChanged={load} cmpOpen={cmp} onToggleCompare={() => setCmp((x) => !x)} />
            {v.question && <p className="card m-0"><strong>Question posée :</strong> {v.question}</p>}
            <p className="hint m-0">Supprimée automatiquement le {v.deleteAfter ? fmtDate(v.deleteAfter) : "—"}.</p>
            <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer définitivement cette vidéo ?")) { await del(`/videos/${id}`); nav(centre && v.player ? `/coach/centre/${v.player.id}?onglet=videos` : "/coach/adultes?onglet=videos"); } }}>Supprimer la vidéo</button>
          </div>
          <div className="grid content-start gap-4">
            {centre ? <SimpleAnalysis v={v} sent={sent} draft={draft} bien={bien} setBien={setBien} travaille={travaille} setTravaille={setTravaille} mot={mot} setMot={setMot} goalIds={goalIds} toggleGoal={toggleGoal} save={save} msg={msg} /> : (
            <form ref={formRef} className="card grid gap-3" noValidate onSubmit={(e) => e.preventDefault()}>
              <h2 className="m-0 text-xl">Mon analyse {v.analysis?.authorName && <AuthorBadge a={v.analysis} prefix="Rédigée par" />} {sent ? <span className="badge ml-2 !border-ok !text-ok">Envoyée</span> : <span className="badge ml-2">Brouillon</span>}</h2>
              <Field label="Observation" id="observation"><textarea id="observation" name="observation" className="input min-h-32" maxLength={3000} defaultValue={v.analysis?.observation ?? ""} /></Field>
              <Field label="Points forts" id="strengths"><textarea id="strengths" name="strengths" className="input" maxLength={2000} defaultValue={v.analysis?.strengths ?? ""} /></Field>
              <Field label="À améliorer" id="improve"><textarea id="improve" name="improve" className="input" maxLength={2000} defaultValue={v.analysis?.improve ?? ""} /></Field>
              {centre ? null : (
                <fieldset className="field"><legend>Exercices à proposer (5 maximum)</legend>
                  {exercises.map((x, i) => (
                    <div key={i} className="flex gap-2"><input className="input" aria-label={`Exercice ${i + 1}`} maxLength={300} value={x} onChange={(e) => setExercises((l) => l.map((y, j) => (j === i ? e.target.value : y)))} /><button type="button" className="btn-outline btn-sm" onClick={() => setExercises((l) => l.filter((_, j) => j !== i))} aria-label={`Retirer l'exercice ${i + 1}`}>✕</button></div>
                  ))}
                  {exercises.length < 5 && <button type="button" className="btn-outline btn-sm self-start" onClick={() => setExercises((l) => [...l, ""])}>+ Ajouter un exercice</button>}
                </fieldset>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-outline" onClick={() => save(false)}>Enregistrer le brouillon</button>
                <button type="button" className="btn-clay" onClick={() => save(true)}>{sent ? "Mettre à jour l'analyse" : "Envoyer l'analyse"}</button>
              </div>
              {msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}
              {!sent && <p className="hint m-0">Tant que l'analyse n'est pas envoyée, {centre ? "la famille" : "l'adhérent"} ne la voit pas et la discussion reste fermée.</p>}
            </form>
            )}
            {sent && (
              <section className="card grid gap-2" aria-label="Discussion">
                <h3 className="m-0">Discussion</h3>
                <Thread messages={v.messages} />
                <form onSubmit={say} className="flex flex-wrap gap-2" noValidate><input className="input min-w-52 flex-1" aria-label="Ton message" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} /><button className="btn-clay btn-sm" disabled={!text.trim()}>Envoyer</button></form>
              </section>
            )}
          </div>
        </div>
        {cmp && <Compare v={v} onClose={() => setCmp(false)} onChanged={load} />}
      </Page>
    </>
  );
}

// Analyse SIMPLE d'un jeune du Centre : deux phrases, un mot facultatif, une mission, un aperçu de ce que l'enfant verra, un seul bouton d'envoi.
// (Le studio, les images annotées et la voix restent à gauche, inchangés.)
function SimpleAnalysis({ v, sent, draft, bien, setBien, travaille, setTravaille, mot, setMot, goalIds, toggleGoal, save, msg }: {
  v: VideoDetail; sent: boolean; draft: boolean; bien: string; setBien: (s: string) => void; travaille: string; setTravaille: (s: string) => void; mot: string; setMot: (s: string) => void;
  goalIds: string[]; toggleGoal: (id: string, on: boolean) => void; save: (send: boolean) => void; msg: { ok: boolean; text: string } | null;
}) {
  const name = v.player?.firstName ?? "le joueur";
  const linked = v.goals.filter((g) => goalIds.includes(g.id));
  return (
    <section className="card grid gap-4" aria-labelledby="vr-simple">
      <h2 id="vr-simple" className="m-0 text-xl">Mon analyse {v.analysis?.authorName && <AuthorBadge a={v.analysis} prefix="Rédigée par" />} {sent ? <span className="badge ml-2 !border-ok !text-ok">Envoyée</span> : <span className="badge ml-2">Brouillon</span>}</h2>
      <Field label="👍 Ce qui est bien" id="vr-bien" hint="Une phrase, simple et encourageante."><textarea id="vr-bien" className="input min-h-20" maxLength={2000} value={bien} onChange={(e) => setBien(e.target.value)} placeholder="Ex. : Belle rotation d'épaules sur ton coup droit !" /></Field>
      <Field label="🎯 Ce qu'on travaille" id="vr-trav" hint="Une phrase : le point sur lequel on se concentre."><textarea id="vr-trav" className="input min-h-20" maxLength={2000} value={travaille} onChange={(e) => setTravaille(e.target.value)} placeholder="Ex. : Lancer la balle un peu plus haut au service." /></Field>
      <Field label={`💬 Un mot pour ${name} (facultatif)`} id="vr-mot"><textarea id="vr-mot" className="input" maxLength={3000} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Un encouragement, un conseil en plus…" /></Field>
      <fieldset className="field"><legend>🚀 Relier à une mission</legend>
        <p className="hint m-0">{name} verra un bouton « 🎬 Voir la vidéo » sur la mission, dans « Mes missions ». C'est enregistré tout de suite.</p>
        {v.goals.length === 0 && <p className="hint m-0">Aucune mission pour ce joueur : crée-en une dans « Définir les objectifs de travail ».</p>}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Missions du joueur">{v.goals.map((g) => {
          const on = goalIds.includes(g.id), ax = AXES.find((a) => a.key === g.axis);
          return <button key={g.id} type="button" aria-pressed={on} onClick={() => toggleGoal(g.id, !on)} className={"min-h-11 rounded-full border-2 px-4 text-left text-sm font-bold " + (on ? "border-clay bg-clay text-white" : "border-line bg-white text-ink hover:bg-sand")}>{on ? "✔ " : ""}{ax?.label} · {g.title}</button>;
        })}</div>
      </fieldset>
      <p className="m-0 rounded-xl bg-sand p-3 text-sm"><strong>🎙️ Ma voix (facultatif) :</strong> {v.audio ? `une note vocale de ${v.audio.seconds} s est jointe (à gauche, sous la vidéo).` : "enregistre-la à gauche, sous la vidéo : elle partira avec l'analyse."}</p>
      <div className="grid gap-2 rounded-2xl p-4 text-white" style={{ background: "linear-gradient(160deg,#4338ca,#3730a3)" }} aria-label={`Aperçu de ce que ${name} va voir`}>
        <strong className="text-sm uppercase tracking-wide text-[#dcf247]">👀 Ce que {name} va voir</strong>
        <div className="grid gap-2 rounded-xl border-2 border-white/35 bg-white/15 p-3">
          <p className="m-0 font-bold">🎓 Analyse de ton coach</p>
          <p className="m-0">{bien.trim() ? <>👍 <strong>Ce qui est bien :</strong> {bien}</> : <span className="text-white/60">👍 Ce qui est bien : à écrire…</span>}</p>
          <p className="m-0">{travaille.trim() ? <>🎯 <strong>Ce qu'on travaille :</strong> {travaille}</> : <span className="text-white/60">🎯 Ce qu'on travaille : à écrire…</span>}</p>
          {mot.trim() && <p className="m-0">💬 {mot}</p>}
          {linked.length > 0 && <p className="m-0">🚀 Mission : {linked.map((g) => g.title).join(" ; ")}</p>}
          {v.audio && <p className="m-0">🎙️ La voix de ton coach ({v.audio.seconds} s)</p>}
          {v.images.length > 0 && <p className="m-0">🖼️ {v.images.length} image{v.images.length > 1 ? "s" : ""} annotée{v.images.length > 1 ? "s" : ""}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline" onClick={() => save(false)}>Enregistrer le brouillon</button>
        <button type="button" className="btn-clay" onClick={() => save(true)}>{sent ? "Mettre à jour l'analyse" : `📤 Envoyer à ${name}`}</button>
      </div>
      {msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}
      {!sent && <p className="hint m-0">{draft ? `Tant que tu n'envoies pas, ${name} ne voit ni la vidéo, ni l'analyse. L'envoi part avec la vidéo, l'analyse, les images annotées et ta voix.` : `Tant que l'analyse n'est pas envoyée, la famille ne la voit pas et la discussion reste fermée.`}</p>}
    </section>
  );
}
