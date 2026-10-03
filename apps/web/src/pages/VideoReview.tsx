import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { del, get, post, put } from "../api";
import { Empty, Err, Field, Page, PageHead } from "../components/ui";
import { Compare, VideoStudio } from "../components/Studio";
import { Thread } from "../components/Videos";
import { AXES, fmtDate, fmtMo, VideoDetail } from "../types";

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
  const [cmp, setCmp] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const load = useCallback(() => {
    get<VideoDetail>(`/videos/${id}`).then((d) => { setV(d); setExercises(d.analysis?.exercises ?? []); setGoalIds(d.analysis?.goalIds ?? []); }).catch(() => setMissing(true));
  }, [id]);
  useEffect(load, [load]);
  if (missing) return <Page><Empty>Cette vidéo est introuvable (elle a peut-être été supprimée).</Empty><Link to="/coach" className="btn-clay no-underline">Retour</Link></Page>;
  if (!v) return <p className="p-8 text-center text-muted">Chargement…</p>;
  const centre = v.kind === "centre";
  const sent = !!v.analysis?.sentAt;

  async function save(thenSend: boolean) {
    const f = new FormData(formRef.current!);
    setMsg(null);
    try {
      await put(`/videos/${id}/analysis`, { observation: String(f.get("observation") || ""), strengths: String(f.get("strengths") || ""), improve: String(f.get("improve") || ""), ...(centre ? { goalIds } : { exercises: exercises.filter((x) => x.trim()) }) });
      if (thenSend) await post(`/videos/${id}/analysis/send`);
      setMsg({ ok: true, text: thenSend ? (sent ? "Analyse mise à jour ✓" : "Analyse envoyée ✓ : l'élève est prévenu dans son espace.") : "Brouillon enregistré ✓" }); load();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }
  async function say(e: FormEvent) { e.preventDefault(); await post(`/videos/${id}/messages`, { text }); setText(""); load(); }

  const who = centre ? `${v.player?.firstName} · Centre de compétition jeunes` : `${v.owner?.firstName || v.owner?.email} · Demande de coaching`;
  return (
    <>
      <PageHead eyebrow={centre ? "Centre de compétition jeunes" : "Demandes de coaching"} title={v.title}>{who} · {v.shot} · {fmtDate(v.recordedAt)} · {fmtMo(v.sizeBytes)}</PageHead>
      <Page>
        <Link to={centre && v.player ? `/coach/centre/${v.player.id}` : "/coach"} className="font-bold text-ink underline">← Retour</Link>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <VideoStudio v={v} onChanged={load} cmpOpen={cmp} onToggleCompare={() => setCmp((x) => !x)} />
            {v.question && <p className="card m-0"><strong>Question posée :</strong> {v.question}</p>}
            <p className="hint m-0">Supprimée automatiquement le {v.deleteAfter ? fmtDate(v.deleteAfter) : "—"}.</p>
            <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer définitivement cette vidéo ?")) { await del(`/videos/${id}`); nav(centre && v.player ? `/coach/centre/${v.player.id}` : "/coach"); } }}>Supprimer la vidéo</button>
          </div>
          <div className="grid content-start gap-4">
            <form ref={formRef} className="card grid gap-3" noValidate onSubmit={(e) => e.preventDefault()}>
              <h2 className="m-0 text-xl">Mon analyse {sent ? <span className="badge ml-2 !border-ok !text-ok">Envoyée</span> : <span className="badge ml-2">Brouillon</span>}</h2>
              <Field label="Observation" id="observation"><textarea id="observation" name="observation" className="input min-h-32" maxLength={3000} defaultValue={v.analysis?.observation ?? ""} /></Field>
              <Field label="Points forts" id="strengths"><textarea id="strengths" name="strengths" className="input" maxLength={2000} defaultValue={v.analysis?.strengths ?? ""} /></Field>
              <Field label="À améliorer" id="improve"><textarea id="improve" name="improve" className="input" maxLength={2000} defaultValue={v.analysis?.improve ?? ""} /></Field>
              {centre ? (
                <fieldset className="field"><legend>Objectifs de l'année concernés</legend>
                  {v.goals.length === 0 && <p className="hint m-0">Aucun objectif fixé pour ce joueur (onglet « Objectifs » de son dossier).</p>}
                  <div className="grid gap-2">{v.goals.map((g) => (
                    <label key={g.id} className="flex min-h-11 items-center gap-3 rounded-xl border-2 border-line bg-white px-3 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
                      <input type="checkbox" className="accent-clay" checked={goalIds.includes(g.id)} onChange={(e) => setGoalIds((l) => (e.target.checked ? [...l, g.id] : l.filter((x) => x !== g.id)))} />
                      <span><strong style={{ color: AXES.find((a) => a.key === g.axis)?.color }}>{AXES.find((a) => a.key === g.axis)?.label}</strong> · {g.title}</span>
                    </label>
                  ))}</div>
                </fieldset>
              ) : (
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
