import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, del, get } from "../api";
import { PlayerPicker } from "./Trainers";
import { AuthorBadge, Empty, Err, Field } from "./ui";
import { fmtDate, fmtMo, Player } from "../types";

export interface TournamentDoc {
  id: string; title: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; deleteAfter: string; players: { id: string; firstName: string }[];
  shared?: boolean; authorName?: string | null; authorRole?: string | null; mine?: boolean; canDelete?: boolean;
}
const MAX = 3 * 1024 * 1024;
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : fmtMo(b));
const icon = (m: string) => (m === "application/pdf" ? "📄" : m.startsWith("image/") ? "🖼️" : m.includes("sheet") ? "📊" : "📝");

export function useTournaments(version = 0) {
  const [docs, setDocs] = useState<TournamentDoc[] | null>(null);
  useEffect(() => { get<TournamentDoc[]>("/tournaments").then(setDocs).catch(() => setDocs([])); }, [version]);
  return docs;
}

// Liste en lecture seule pour le jeune et sa famille : seulement ce que le coach ou l'entraîneur a choisi de partager
export function FamilyTournaments({ dark = false }: { dark?: boolean }) {
  const docs = useTournaments();
  if (!docs || docs.length === 0) return null;
  return (
    <section className={dark ? "glass gal-pop grid gap-3" : "card grid gap-3"} aria-labelledby="fam-tournois">
      <h2 id="fam-tournois" className="m-0 text-2xl">📅 Programmation des tournois</h2>
      <ul className="m-0 grid list-none gap-2 p-0">
        {docs.map((d) => (
          <li key={d.id} className={"flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 " + (dark ? "bg-white/10" : "bg-sand/60")}>
            <span className="min-w-0"><strong>{icon(d.mimeType)} {d.title}</strong><small className="block opacity-80">Déposé le {fmtDate(d.createdAt)} · {size(d.sizeBytes)}</small></span>
            <a href={`/api/tournaments/${d.id}/file`} target="_blank" rel="noopener noreferrer" className={dark ? "gal-btn btn-sm no-underline" : "btn-outline btn-sm no-underline"}>Ouvrir le document</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Coach et entraîneurs de comité : déposer la programmation d'un tournoi (document déjà fait), la retrouver, la supprimer
export function TournamentsTab({ players, isCoach }: { players: Player[]; isCoach: boolean }) {
  const [version, setVersion] = useState(0);
  const docs = useTournaments(version);
  const [picked, setPicked] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [err, setErr] = useState(""), [ok, setOk] = useState(""), [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setErr(""); setOk("");
    const doc = file.current?.files?.[0], title = String(f.get("title") || "").trim();
    if (!doc) return setErr("Choisis le document à déposer.");
    if (doc.size > MAX) return setErr(`Ce document pèse ${fmtMo(doc.size)} : le maximum est 3 Mo. Enregistre-le en PDF plus léger.`);
    if (!title) return setErr("Donne un titre au document (ex. : Tournoi de Dreux, 12 octobre).");
    if (!picked.length) return setErr("Choisis au moins un jeune concerné.");
    setBusy(true);
    try {
      await api(`/tournaments?title=${encodeURIComponent(title)}&fileName=${encodeURIComponent(doc.name)}&playerIds=${picked.join(",")}&shared=${shared ? 1 : 0}`, { method: "POST", body: doc, headers: { "Content-Type": "application/octet-stream" } });
      form.reset(); setPicked([]); setShared(false); setOk("Document déposé ✓"); reload();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="grid gap-4" aria-labelledby="tn-h">
      <div className="grid gap-1">
        <h2 id="tn-h" className="m-0 text-xl">📅 Programmation des tournois</h2>
        <p className="hint m-0">Dépose un document déjà fait (PDF, image, Word ou Excel, 3 Mo maximum). {isCoach ? "Tu le vois, ainsi que les entraîneurs des jeunes concernés." : "Le coach le voit, ainsi que toi et les autres entraîneurs de ces jeunes."} Les documents sont supprimés automatiquement après 12 mois.</p>
      </div>
      <form onSubmit={submit} className="card grid gap-4 border-2 !border-clay" noValidate>
        <h3 className="m-0">Déposer un document</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre" id="tn-title"><input id="tn-title" name="title" required maxLength={120} className="input" placeholder="Ex. : Tournoi de Dreux, 12 octobre" /></Field>
          <Field label="Le document" id="tn-file"><input id="tn-file" ref={file} type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,application/pdf,image/png,image/jpeg" className="input !py-2" /></Field>
        </div>
        <PlayerPicker players={players} value={picked} onChange={setPicked} name="ce document" label="Jeunes concernés" />
        <label className="flex items-start gap-3 rounded-xl border-2 border-line bg-white p-3 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-clay" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          <span>Montrer aux jeunes et à leur famille<small className="block font-normal text-muted">Par défaut, seuls le coach et les entraîneurs le voient. Si tu le partages, chaque famille verra le document en entier : il ne doit contenir que des informations qui la concernent (pas de nom d'autres enfants).</small></span>
        </label>
        <Err msg={err} />
        {ok && <p role="status" className="m-0 font-bold text-ok">{ok}</p>}
        <div><button className="btn-clay" disabled={busy}>{busy ? "Envoi…" : "Déposer le document"}</button></div>
      </form>
      {docs === null ? <div className="skeleton h-24" role="status" aria-label="Chargement en cours" /> : docs.length === 0 ? <Empty>Aucun document déposé pour l'instant.</Empty> : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {docs.map((d) => (
            <li key={d.id} className="card flex flex-wrap items-center justify-between gap-3">
              <span className="grid min-w-0 gap-1">
                <strong className="text-lg">{icon(d.mimeType)} {d.title}</strong>
                <small className="hint">{d.fileName} · {size(d.sizeBytes)} · déposé le {fmtDate(d.createdAt)} · supprimé automatiquement le {fmtDate(d.deleteAfter)}</small>
                <span className="flex flex-wrap items-center gap-2 text-sm"><span>Pour : <strong>{d.players.map((p) => p.firstName).join(", ")}</strong></span>
                  <span className="badge">{d.shared ? "👪 Visible par les familles" : "🔒 Privé (coach et entraîneurs)"}</span><AuthorBadge a={d} prefix="Déposé par" /></span>
              </span>
              <span className="flex flex-wrap gap-2">
                <a href={`/api/tournaments/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm no-underline">Ouvrir</a>
                {d.canDelete && <button className="btn-danger btn-sm" onClick={async () => { if (confirm(`Supprimer « ${d.title} » ?`)) { try { await del(`/tournaments/${d.id}`); reload(); } catch (x) { setErr((x as Error).message); } } }}>Supprimer</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
