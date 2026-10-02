import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, post } from "../api";
import { Empty, Err, Field, Page, PageHead } from "../components/ui";
import { fmtDate, fullName, Lesson, Player } from "../types";

const TYPES: Record<string, string> = { individuel: "Cours individuel", duo: "Cours à deux", video: "Reprise d'une analyse vidéo" };

function LessonRow({ l, onDone }: { l: Lesson; onDone: () => void }) {
  const [ask, setAsk] = useState<"ACCEPTED" | "REFUSED" | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  async function send() {
    try { await post(`/lessons/${l.id}/answer`, { status: ask, reply: reply || undefined }); onDone(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <li className="card flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <strong>{l.member?.firstName || l.member?.email} — {TYPES[l.type] ?? "Cours"} · {l.objective}</strong>
        <p className="m-0 text-sm text-muted">📅 {(l.days.length ? l.days.join(", ") : "Jours à définir") + " · " + l.moment}</p>
        {l.message && <p className="m-0 text-sm text-muted">« {l.message} »</p>}
      </div>
      {l.status === "PENDING" ? (
        ask ? (
          <div className="flex w-full flex-wrap gap-2">
            <input className="input min-w-52 flex-1" maxLength={200} aria-label="Message pour l'adhérent (facultatif)" placeholder={ask === "ACCEPTED" ? "Ex. : Samedi 10h, court 2" : "Ex. : Pas de créneau cette semaine"} value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
            <button className={ask === "ACCEPTED" ? "btn-clay btn-sm" : "btn-danger btn-sm"} onClick={send}>{ask === "ACCEPTED" ? "Confirmer l'acceptation" : "Confirmer le refus"}</button>
            <button className="btn-outline btn-sm" onClick={() => setAsk(null)}>Annuler</button>
            <Err msg={err} />
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-clay btn-sm" onClick={() => setAsk("ACCEPTED")}>Accepter</button>
            <button className="btn-danger btn-sm" onClick={() => setAsk("REFUSED")}>Refuser</button>
          </div>
        )
      ) : (
        <span className={"badge " + (l.status === "ACCEPTED" ? "!border-ok !text-ok" : "!border-bad !text-bad")}>{l.status === "ACCEPTED" ? "Acceptée" : "Refusée"}</span>
      )}
    </li>
  );
}

export function CoachHome() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const load = useCallback(() => { get<Lesson[]>("/lessons").then(setLessons); get<Player[]>("/players").then(setPlayers); }, []);
  useEffect(load, [load]);
  const pending = lessons.filter((l) => l.status === "PENDING");
  const done = lessons.filter((l) => l.status !== "PENDING");

  return (
    <>
      <PageHead eyebrow="Espace coach" title="Bonjour coach !">Deux espaces distincts : les demandes de coaching des adhérents, et le Centre de compétition jeunes.</PageHead>
      <Page>
        <section className="card grid gap-3" aria-labelledby="t-coaching">
          <h2 id="t-coaching" className="m-0">Demandes de coaching</h2>
          <p className="hint m-0">Adhérents adultes qui te contactent : demandes de cours.</p>
          <ul className="m-0 grid list-none gap-3 p-0">
            {pending.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}
            {!pending.length && <li><Empty>Aucune demande de coaching en attente 🎾</Empty></li>}
          </ul>
          {done.length > 0 && (
            <details>
              <summary className="cursor-pointer font-bold text-muted">Historique ({done.length})</summary>
              <ul className="mt-3 grid list-none gap-2 p-0">{done.map((l) => <LessonRow key={l.id} l={l} onDone={load} />)}</ul>
            </details>
          )}
        </section>

        <section className="card grid gap-3 border-t-[6px] border-t-clay bg-[#fffaf5]" aria-labelledby="t-centre">
          <h2 id="t-centre" className="m-0">Centre de compétition jeunes</h2>
          <p className="hint m-0">Suivi des jeunes compétiteurs. Séparé des demandes de coaching.</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0"><strong>{players.length} jeune{players.length > 1 ? "s" : ""} suivi{players.length > 1 ? "s" : ""}</strong></p>
            <Link to="/coach/centre" className="btn-clay btn-sm no-underline">Ouvrir le Centre</Link>
          </div>
        </section>
      </Page>
    </>
  );
}

export function Centre() {
  const nav = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [inactive, setInactive] = useState<{ id: string; firstName: string; lastName: string; lastActivityAt: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => { get<Player[]>("/players").then(setPlayers); get("/players/inactive").then(setInactive); }, []);
  useEffect(load, [load]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try {
      const p = await post<Player>("/players", { firstName: String(f.get("firstName")), lastName: String(f.get("lastName") || ""), birthDate: f.get("birthDate") || undefined });
      nav(`/coach/centre/${p.id}`);
    } catch (e2) { setErr((e2 as Error).message); }
  }

  return (
    <>
      <PageHead eyebrow="Centre de compétition jeunes" title="Mes jeunes compétiteurs">Profil, objectifs de l'année, accords des parents et accès des familles.</PageHead>
      <Page>
        <p className="alert m-0"><strong>Données de mineurs.</strong> Avant de filmer ou de suivre un jeune, enregistre l'accord écrit de son responsable légal dans sa fiche (onglet « Accords »).</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0">Mes joueurs</h2>
          <button className="btn-clay btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>+ Ajouter un joueur</button>
        </div>
        {open && (
          <form onSubmit={add} className="card grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Prénom" id="p-first"><input id="p-first" name="firstName" required maxLength={60} className="input" autoFocus /></Field>
            <Field label="Nom" id="p-last"><input id="p-last" name="lastName" maxLength={60} className="input" /></Field>
            <Field label="Date de naissance" id="p-birth"><input id="p-birth" name="birthDate" type="date" className="input" /></Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <button className="btn-clay">Créer la fiche</button>
              <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Annuler</button>
            </div>
            <div className="sm:col-span-2"><Err msg={err} /></div>
          </form>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <Link key={p.id} to={`/coach/centre/${p.id}`} className="card no-underline transition-shadow hover:shadow-md">
              <h3 className="m-0">{fullName(p)}</h3>
              <p className="hint m-0">{[p.ranking && `Classement ${p.ranking}`, p.hand].filter(Boolean).join(" · ") || "Fiche à compléter"}</p>
            </Link>
          ))}
          {!players.length && <div className="sm:col-span-2 lg:col-span-3"><Empty>Aucun joueur pour l'instant. Ajoute le premier avec le bouton ci-dessus.</Empty></div>}
        </div>
        {inactive.length > 0 && (
          <section className="card grid gap-2">
            <h2 className="m-0">Dossiers inactifs depuis plus de 12 mois</h2>
            <p className="hint m-0">Les données d'un jeune qui a quitté le club ne doivent pas être gardées : télécharge une copie si besoin, puis supprime.</p>
            {inactive.map((p) => <Link key={p.id} to={`/coach/centre/${p.id}`} className="font-bold text-clay underline">{fullName(p)} — dernière activité le {fmtDate(p.lastActivityAt)}</Link>)}
          </section>
        )}
      </Page>
    </>
  );
}
