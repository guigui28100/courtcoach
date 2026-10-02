import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post, del } from "../api";
import { useAuth } from "../auth";
import { AXES, currentSeason, fmtDate, fullName, Goal, Lesson, Player } from "../types";
import { Empty, Err, Field, Page, PageHead, ProgressBar } from "../components/ui";

const TYPES: Record<string, string> = { individuel: "Cours individuel", duo: "Cours à deux", video: "Reprise d'une analyse vidéo" };
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const STATUS = { PENDING: ["En attente", "!border-[#c08a00] !text-[#7a5a00] !bg-[#fff3cd]"], ACCEPTED: ["Acceptée", "!border-ok !text-ok !bg-[#e6f5ec]"], REFUSED: ["Refusée", "!border-bad !text-bad !bg-[#fdf0ee]"] } as const;

// Espace de l'adhérent adulte : demandes de cours et réponse du coach, visibles tout de suite.
export function AdultSpace() {
  const { me, eraseAccount } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => { get<Lesson[]>("/lessons").then(setLessons); }, []);
  useEffect(load, [load]);
  const fresh = lessons.filter((l) => l.status !== "PENDING" && !l.seenByMemberAt);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try { await post("/lessons", { type: f.get("type"), objective: String(f.get("objective")), days: f.getAll("days"), moment: f.get("moment"), message: String(f.get("message") || "") || undefined }); setOpen(false); load(); } catch (x) { setErr((x as Error).message); }
  }
  async function exportData() {
    const data = await get("/auth/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "mes-donnees-courtcoach.json" });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      <PageHead eyebrow="Mon espace" title={me?.firstName ? `Bonjour ${me.firstName} !` : "Bienvenue sur CourtCoach !"}>Demande un cours à ton coach et retrouve ici ses réponses.</PageHead>
      <Page>
        {fresh.length > 0 && (
          <div className="grid gap-2" role="status" aria-live="polite">
            {fresh.map((l) => (
              <div key={l.id} className={"flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 " + (l.status === "ACCEPTED" ? "border-ok bg-[#eef8f1]" : "border-bad bg-[#fdf0ee]")}>
                <div>
                  <strong>{l.status === "ACCEPTED" ? "✅ Ton coach a accepté ta demande de cours" : "❌ Ton coach ne peut pas donner suite à ta demande"}</strong>
                  <p className="m-0">{TYPES[l.type]} · {l.objective}{l.coachReply && ` — « ${l.coachReply} »`}</p>
                </div>
                <button className="btn-outline btn-sm" onClick={async () => { await post(`/lessons/${l.id}/seen`); load(); }}>J'ai vu</button>
              </div>
            ))}
          </div>
        )}

        {lessons.length > 0 && (
          <section aria-labelledby="t-dem" className="grid gap-3">
            <h2 id="t-dem" className="m-0">Mes demandes de cours</h2>
            <ul className="m-0 grid list-none gap-3 p-0">
              {lessons.map((l) => (
                <li key={l.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{TYPES[l.type]} · {l.objective}</strong>
                    <p className="m-0 text-sm text-muted">{(l.days.length ? l.days.join(", ") : "Jours à définir") + " · " + l.moment} — demandé le {fmtDate(l.createdAt)}</p>
                    {l.coachReply && <p className="m-0 text-sm font-bold">💬 Réponse du coach : « {l.coachReply} »</p>}
                  </div>
                  <span className={"badge " + STATUS[l.status][1]}>{STATUS[l.status][0]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card grid gap-3">
          <h2 className="m-0">Demander un cours particulier</h2>
          <p className="m-0 text-muted">Tu veux travailler avec ton coach en direct ? Envoie ta demande en quelques secondes.</p>
          <button className="btn-clay self-start" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Masquer le formulaire" : "Demander un cours"}</button>
          {open && (
            <form onSubmit={send} className="grid gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type de cours" id="type"><select id="type" name="type" className="input">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Sur quoi veux-tu travailler ?" id="objective"><select id="objective" name="objective" className="input">{["Coup droit", "Revers", "Service", "Retour de service", "Volée", "Smash", "Jeu de jambes", "Autre"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              </div>
              <fieldset className="field"><legend>Jours qui t'arrangent</legend>
                <div className="flex flex-wrap gap-2">{DAYS.map((d) => <label key={d} className="flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-white px-4 font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]"><input type="checkbox" name="days" value={d} className="accent-clay" />{d.slice(0, 3)}.</label>)}</div>
              </fieldset>
              <Field label="Moment de la journée" id="moment"><select id="moment" name="moment" className="input">{["Peu importe", "Matin", "Après-midi", "Soirée"].map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Un message pour ton coach (facultatif)" id="message"><textarea id="message" name="message" className="input" maxLength={500} /></Field>
              <Err msg={err} />
              <button className="btn-clay self-start">Envoyer ma demande</button>
            </form>
          )}
        </section>

        <section className="card grid gap-3 border-dashed">
          <h2 className="m-0 text-lg">Mes données</h2>
          <p className="hint m-0">Tu peux récupérer ou effacer tes données quand tu veux. <Link to="/confidentialite" className="font-bold text-clay underline">Politique de confidentialité</Link></p>
          <div className="flex flex-wrap gap-2">
            <Link to="/mot-de-passe" className="btn-outline btn-sm no-underline">Changer mon mot de passe</Link>
            <button className="btn-outline btn-sm" onClick={exportData}>Télécharger mes données</button>
            <button className="btn-danger btn-sm" onClick={async () => { if (confirm("Supprimer définitivement ton compte et tes données ?")) { await eraseAccount(); window.location.href = "/"; } }}>Supprimer mon compte</button>
          </div>
        </section>
      </Page>
    </>
  );
}

// Espace des parents (et des jeunes invités) : suivi du joueur, en lecture seule.
export function FamilySpace() {
  const { me, eraseAccount } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  useEffect(() => {
    get<Player[]>("/players").then(async (ps) => {
      setPlayers(ps);
      const entries = await Promise.all(ps.map(async (p) => [p.id, await get<Goal[]>(`/players/${p.id}/goals?season=${currentSeason()}`).catch(() => [] as Goal[])] as const));
      setGoals(Object.fromEntries(entries));
    }).catch(() => setPlayers([]));
  }, []);

  return (
    <>
      <PageHead eyebrow="Mon suivi" title={me?.firstName ? `Bonjour ${me.firstName}` : "Mon suivi"}>Les objectifs de la saison, en lecture seule. Les évaluations et les bulletins arriveront dans cet espace.</PageHead>
      <Page>
        {!players.length && <Empty>Ton coach n'a pas encore ouvert de suivi.</Empty>}
        {players.map((p) => {
          const list = goals[p.id] ?? [];
          const total = list.length ? Math.round(list.reduce((s, g) => s + g.progress, 0) / list.length) : null;
          return (
            <section key={p.id} className="card grid gap-4" aria-label={`Suivi de ${p.firstName}`}>
              <h2 className="m-0">{fullName(p)}</h2>
              <p className="m-0 font-bold">{total === null ? "Aucun objectif fixé pour cette saison" : `Objectifs de la saison atteints à ${total} %`}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {AXES.map((a) => {
                  const mine = list.filter((g) => g.axis === a.key);
                  if (!mine.length) return null;
                  return (
                    <div key={a.key} className="grid gap-2 rounded-xl border-t-[6px] border border-line p-3" style={{ borderTopColor: a.color }}>
                      <h3 className="m-0" style={{ color: a.color }}>{a.label}</h3>
                      {mine.map((g) => <div key={g.id} className="grid gap-1"><strong>{g.title}</strong>{g.indicator && <small className="hint">{g.indicator}</small>}<ProgressBar value={g.progress} color={a.color} /><small className="font-bold">{g.progress} %</small></div>)}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <section className="card grid gap-3 border-dashed">
          <h2 className="m-0 text-lg">Mes données</h2>
          <p className="hint m-0"><Link to="/confidentialite" className="font-bold text-clay underline">Politique de confidentialité</Link> · Pour demander une copie ou la suppression du dossier de l'enfant, écris au club.</p>
          <Link to="/mot-de-passe" className="btn-outline btn-sm self-start no-underline">Changer mon mot de passe</Link>
          <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer définitivement ton compte (le dossier du joueur reste au club) ?")) { await eraseAccount(); window.location.href = "/"; } }}>Supprimer mon compte</button>
        </section>
      </Page>
    </>
  );
}
