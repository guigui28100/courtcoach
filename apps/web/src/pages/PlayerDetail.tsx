import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { del, get, patch, post, put } from "../api";
import { Empty, Err, Field, Page, PageHead, ProgressBar } from "../components/ui";
import { VideoUpload, useVideos, VideoBadge } from "../components/Videos";
import { Bulletins, Evaluations, Matchs } from "../components/CoachFollowUp";
import { AXES, checkpointAt, Consent, currentSeason, fmtDate, fullName, Goal, GoalCheckpoint, goalApplies, GoalStatus, isCarriedOver, Player, progressAt, STATUS, statusAt, trimesterOf, trimestersOf } from "../types";

type Tab = "profil" | "accords" | "objectifs" | "evaluations" | "videos" | "matchs" | "bulletins";
const CONSENT_LABEL: Record<Consent["kind"], string> = {
  PRIVACY_POLICY: "Politique de confidentialité", FOLLOW_UP: "Suivi sportif (objectifs, évaluations, bulletins)",
  IMAGE: "Droit à l'image (filmer pour analyser)", HEALTH: "Informations de santé (facultatif)", ACCOUNT: "Compte en ligne du jeune",
};
const RANKINGS = ["NC", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6"];

function Profil({ p, onSaved }: { p: Player; onSaved: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries());
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) { if (k === "heightCm") { if (v) body[k] = Number(v); } else if (k === "birthDate") { if (v) body[k] = v; } else body[k] = String(v); }
    try { await patch(`/players/${p.id}`, body); setMsg({ ok: true, text: "Enregistré ✓" }); onSaved(); } catch (er) { setMsg({ ok: false, text: (er as Error).message }); }
  }
  const t = (id: keyof Player, label: string, extra?: { hint?: string; type?: string }) => (
    <Field label={label} id={id} hint={extra?.hint}><input id={id} name={id} type={extra?.type ?? "text"} defaultValue={(p[id] as string | number | null) ?? ""} className="input" /></Field>
  );
  return (
    <form onSubmit={save} className="grid gap-4" noValidate>
      <fieldset className="card grid gap-4 sm:grid-cols-2"><legend className="px-2 font-display font-bold">Identité</legend>
        {t("firstName", "Prénom")}{t("lastName", "Nom")}
        <Field label="Date de naissance" id="birthDate"><input id="birthDate" name="birthDate" type="date" className="input" defaultValue={p.birthDate?.slice(0, 10) ?? ""} /></Field>
        {t("club", "Club")}{t("licence", "N° de licence FFT")}{t("heightCm", "Taille (cm)", { type: "number" })}
      </fieldset>
      <fieldset className="card grid gap-4 sm:grid-cols-2"><legend className="px-2 font-display font-bold">Tennis et compétition</legend>
        {(["ranking", "targetRanking"] as const).map((k) => (
          <Field key={k} label={k === "ranking" ? "Classement actuel" : "Objectif de classement"} id={k}>
            <select id={k} name={k} className="input" defaultValue={p[k] ?? ""}><option value="">Choisir…</option>{RANKINGS.map((r) => <option key={r}>{r}</option>)}</select>
          </Field>
        ))}
        {t("hand", "Main")}{t("backhand", "Revers")}{t("playStyle", "Style de jeu")}{t("training", "Entraînement et compétitions")}{t("availability", "Disponibilités")}
      </fieldset>
      <fieldset className="card grid gap-4"><legend className="px-2 font-display font-bold">Santé (facultatif)</legend>
        <Field label="Blessures et points d'attention" id="health" hint="Seulement ce qui aide à adapter les exercices, jamais de diagnostic médical. Visible par le coach et les parents.">
          <textarea id="health" name="health" className="input" defaultValue={p.health ?? ""} maxLength={1000} />
        </Field>
      </fieldset>
      <fieldset className="card grid gap-4"><legend className="px-2 font-display font-bold">Notes privées</legend>
        <Field label="Notes du coach" id="coachNotes" hint="Seul toi peux les lire : jamais visibles par les familles."><textarea id="coachNotes" name="coachNotes" className="input" defaultValue={p.coachNotes ?? ""} maxLength={3000} /></Field>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3"><button className="btn-clay">Enregistrer</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
    </form>
  );
}

function Accords({ p, onChanged }: { p: Player; onChanged: () => void }) {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [invite, setInvite] = useState<{ url: string; days: number } | null>(null);
  const [created, setCreated] = useState<{ email: string; password?: string; existing: boolean } | null>(null);
  const [accesses, setAccesses] = useState<{ userId: string; email: string; role: string; mustChangePassword: boolean; lastLoginAt: string | null }[]>([]);
  const loadAccess = useCallback(() => { get(`/players/${p.id}/access`).then(setAccesses); }, [p.id]);
  useEffect(loadAccess, [loadAccess]);
  const active = (k: Consent["kind"]) => p.consents?.find((c) => c.kind === k && !c.withdrawnAt);

  async function addConsent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // à garder avant le « await » : React vide l'événement ensuite
    const f = new FormData(form);
    setErr("");
    try { await post(`/players/${p.id}/consents`, { kind: f.get("kind"), givenBy: String(f.get("givenBy")), method: f.get("method") }); form.reset(); onChanged(); } catch (x) { setErr((x as Error).message); }
  }
  async function sendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(""); setInvite(null);
    try {
      const r = await post<{ token: string; expiresInDays: number }>(`/players/${p.id}/invitations`, { email: String(f.get("email")), role: f.get("role") });
      setInvite({ url: `${window.location.origin}/invitation/${r.token}`, days: r.expiresInDays });
    } catch (x) { setErr((x as Error).message); }
  }
  async function createAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErr(""); setCreated(null);
    try {
      const r = await post<{ email: string; temporaryPassword?: string; existingAccount: boolean }>(`/players/${p.id}/access`, { email: String(f.get("email")), role: f.get("role") });
      setCreated({ email: r.email, password: r.temporaryPassword, existing: r.existingAccount });
      form.reset(); loadAccess();
    } catch (x) { setErr((x as Error).message); }
  }
  async function exportData() {
    const data = await get(`/players/${p.id}/export`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `dossier-${fullName(p).replace(/[^\p{L}\p{N}-]+/gu, "_").slice(0, 30)}.json` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function erase() {
    if (!confirm(`Supprimer définitivement le dossier de ${fullName(p)} (profil, objectifs, évaluations, vidéos, analyses) ?`)) return;
    await del(`/players/${p.id}`); nav("/coach/centre");
  }

  return (
    <div className="grid gap-4">
      <section className="card grid gap-3">
        <h3 className="m-0">Accords des parents</h3>
        <p className="hint m-0">Fais signer le <Link to="/autorisation" target="_blank" className="font-bold text-clay underline">formulaire d'autorisation parentale</Link>, puis enregistre ici ce qui a été accordé. Sans accord « droit à l'image », aucune vidéo ne doit être ajoutée.</p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {(["FOLLOW_UP", "IMAGE", "HEALTH", "ACCOUNT"] as const).map((k) => {
            const c = active(k);
            return (
              <li key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                <span>{c ? "✅" : "⬜"} {CONSENT_LABEL[k]}{c && <small className="hint block">Par {c.givenBy} · {c.method === "paper" ? "papier signé" : "en ligne"} · {fmtDate(c.grantedAt)}</small>}</span>
                {c && <button className="btn-outline btn-sm" onClick={async () => { await post(`/players/${p.id}/consents/${c.id}/withdraw`); onChanged(); }}>Retirer l'accord</button>}
              </li>
            );
          })}
        </ul>
        <form onSubmit={addConsent} className="grid gap-3 sm:grid-cols-4" noValidate>
          <Field label="Accord" id="c-kind"><select id="c-kind" name="kind" className="input">{(["FOLLOW_UP", "IMAGE", "HEALTH", "ACCOUNT"] as const).map((k) => <option key={k} value={k}>{CONSENT_LABEL[k]}</option>)}</select></Field>
          <Field label="Donné par (responsable légal)" id="c-by"><input id="c-by" name="givenBy" required maxLength={100} className="input" /></Field>
          <Field label="Comment" id="c-method"><select id="c-method" name="method" className="input"><option value="paper">Papier signé</option><option value="online">En ligne</option></select></Field>
          <div className="flex items-end"><button className="btn-clay w-full">Enregistrer l'accord</button></div>
        </form>
      </section>

      <section className="card grid gap-3">
        <h3 className="m-0">Créer l'accès de la famille (identifiant + mot de passe)</h3>
        <p className="hint m-0">L'identifiant est l'e-mail du parent. Un <strong>mot de passe provisoire</strong> est créé et affiché une seule fois : donne-le à la famille. À sa première connexion, elle choisit son propre mot de passe (tu ne le connaîtras jamais). Lecture seule : objectifs, évaluations, bulletins, jamais tes notes privées. Un parent qui a déjà un compte (plusieurs enfants) reçoit simplement l'accès à cette fiche.</p>
        <form onSubmit={createAccess} className="grid gap-3 sm:grid-cols-3" noValidate>
          <Field label="E-mail (identifiant)" id="a-mail"><input id="a-mail" name="email" type="email" required maxLength={254} className="input" /></Field>
          <Field label="Pour" id="a-role"><select id="a-role" name="role" className="input"><option value="GUARDIAN">Un parent / responsable légal</option><option value="YOUTH">Le jeune lui-même (accord « compte en ligne » requis)</option></select></Field>
          <div className="flex items-end"><button className="btn-clay w-full">Créer l'accès</button></div>
        </form>
        {created && (
          <div className="alert" role="status">
            {created.existing ? (
              <p className="m-0 font-bold">✅ {created.email} a déjà un compte : l'accès à cette fiche vient d'être ajouté (même mot de passe qu'avant).</p>
            ) : (
              <>
                <p className="m-0 font-bold">Accès créé. Note ces informations maintenant, elles ne seront plus affichées :</p>
                <p className="m-0 mt-2">Identifiant : <strong>{created.email}</strong></p>
                <p className="m-0">Mot de passe provisoire : <code className="rounded bg-white px-2 py-1 text-base font-bold">{created.password}</code></p>
                <p className="hint m-0 mt-2">Transmets-les de vive voix ou par message à la famille, puis supprime le message. Le mot de passe provisoire est à changer à la première connexion.</p>
              </>
            )}
          </div>
        )}
        {accesses.length > 0 && (
          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Personnes ayant accès à cette fiche">
            {accesses.map((a) => (
              <li key={a.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                <span><strong>{a.email}</strong> · {a.role === "YOUTH" ? "jeune" : "parent"}<small className="hint block">{a.mustChangePassword ? "Mot de passe provisoire pas encore changé" : a.lastLoginAt ? `Dernière connexion le ${fmtDate(a.lastLoginAt)}` : "Jamais connecté"}</small></span>
                <span className="flex flex-wrap gap-2">
                <button className="btn-outline btn-sm" onClick={async () => { if (confirm(`Donner un nouveau mot de passe provisoire à ${a.email} ? L'ancien ne marchera plus.`)) { try { const r = await post<{ email: string; temporaryPassword: string }>(`/players/${p.id}/access/${a.userId}/reset-password`); setCreated({ email: r.email, password: r.temporaryPassword, existing: false }); loadAccess(); } catch (x) { alert((x as Error).message); } } }}>Mot de passe oublié</button>
                <button className="btn-danger btn-sm" onClick={async () => { if (confirm(`Retirer l'accès de ${a.email} ?`)) { await del(`/players/${p.id}/access/${a.userId}`); loadAccess(); } }}>Retirer l'accès</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card grid gap-3">
        <h3 className="m-0">Autre méthode : lien d'invitation</h3>
        <p className="hint m-0">Invite un parent (ou le jeune, si l'accord « compte en ligne » est enregistré). Un lien personnel, valable 7 jours et à usage unique, t'est donné : envoie-le toi-même. Ils verront objectifs, évaluations et bulletins, jamais tes notes privées.</p>
        <form onSubmit={sendInvite} className="grid gap-3 sm:grid-cols-3" noValidate>
          <Field label="E-mail" id="i-mail"><input id="i-mail" name="email" type="email" required maxLength={254} className="input" /></Field>
          <Field label="Pour" id="i-role"><select id="i-role" name="role" className="input"><option value="GUARDIAN">Un parent / responsable légal</option><option value="YOUTH">Le jeune lui-même</option></select></Field>
          <div className="flex items-end"><button className="btn-ink w-full">Créer le lien d'invitation</button></div>
        </form>
        {invite && (
          <div className="alert" role="status">
            <p className="m-0 font-bold">Lien à envoyer (valable {invite.days} jours, affiché une seule fois) :</p>
            <input readOnly className="input mt-2" value={invite.url} onFocus={(e) => e.currentTarget.select()} aria-label="Lien d'invitation" />
          </div>
        )}
      </section>

      <Err msg={err} />
      <section className="card grid gap-3 border-dashed">
        <h3 className="m-0">Données</h3>
        <p className="hint m-0">Le responsable légal peut demander une copie ou la suppression du dossier à tout moment.</p>
        <div className="flex flex-wrap gap-2"><button className="btn-outline btn-sm" onClick={exportData}>Télécharger le dossier (copie des données)</button><button className="btn-danger btn-sm" onClick={erase}>Supprimer ce joueur</button></div>
      </section>
    </div>
  );
}

// « Préparer le trimestre suivant » : pour chaque objectif, le clore (atteint), le reconduire (pas atteint) ou le remplacer, puis en ajouter de nouveaux.
// Les bulletins déjà faits ne bougent pas : seuls les trimestres suivants sont modifiés.
function PrepareNext({ p, season, t, goals, onDone, onNext }: { p: Player; season: string; t: number; goals: Goal[]; onDone: () => void; onNext: () => void }) {
  type Choice = "close" | "keep" | "replace";
  const mine = goals.filter((g) => goalApplies(g, t));
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [news, setNews] = useState<{ axis: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const next = t + 1;
  const pick = (g: Goal): Choice => choice[g.id] ?? (statusAt(g, t) === "ACHIEVED" ? "close" : "keep");
  const CHOICES: [Choice, string][] = [["close", "✅ Clore (atteint)"], ["keep", `🔁 Reconduire au T${next}`], ["replace", "✏️ Remplacer"]];

  async function apply() {
    setBusy(true); setMsg(null);
    const count = { close: 0, keep: 0, replace: 0, added: 0 };
    try {
      for (const g of mine) {
        const c = pick(g);
        if (c === "replace" && !(titles[g.id] ?? "").trim()) throw new Error(`Écris le nouvel objectif qui remplace « ${g.title} ».`);
      }
      for (const g of mine) {
        const c = pick(g), cur = trimestersOf(g);
        if (c === "keep") { await patch(`/goals/${g.id}`, { trimesters: [...new Set([...cur, next])].sort() }); count.keep++; }
        else {
          await patch(`/goals/${g.id}`, { trimesters: cur.filter((x) => x <= t) }); // l'objectif s'arrête ici : son bulletin ne change pas
          if (c === "replace") { await post(`/players/${p.id}/goals`, { season, axis: g.axis, title: titles[g.id].trim(), trimesters: [next] }); count.replace++; } else count.close++;
        }
      }
      for (const n of news.filter((x) => x.title.trim())) { await post(`/players/${p.id}/goals`, { season, axis: n.axis, title: n.title.trim(), trimesters: [next] }); count.added++; }
      setNews([]); setChoice({}); setTitles({}); onDone();
      setMsg({ ok: true, text: `Le trimestre ${next} est prêt : ${count.keep} reconduit${count.keep > 1 ? "s" : ""}, ${count.close} clôturé${count.close > 1 ? "s" : ""}, ${count.replace} remplacé${count.replace > 1 ? "s" : ""}, ${count.added} nouveau${count.added > 1 ? "x" : ""}.` });
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
    setBusy(false);
  }

  return (
    <details className="card" open={false}>
      <summary className="cursor-pointer font-display text-lg font-bold">➡️ Préparer le trimestre {next}</summary>
      <div className="mt-3 grid gap-3">
        <p className="hint m-0">Pour chaque objectif du trimestre {t} : <strong>clore</strong> s'il est atteint, <strong>reconduire</strong> s'il ne l'est pas encore, ou le <strong>remplacer</strong> par un nouveau. Le bulletin du trimestre {t} ne change pas. Pense à évaluer d'abord chaque objectif dans l'onglet Évaluations.</p>
        {mine.length === 0 && <p className="m-0 text-muted">Aucun objectif à travailler ce trimestre.</p>}
        <ul className="m-0 grid list-none gap-2 p-0">
          {mine.map((g) => { const c = pick(g), st = statusAt(g, t); return (
            <li key={g.id} className="grid gap-2 rounded-xl border border-line bg-chalk p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong>{g.title}</strong><span className="badge" style={st ? { background: STATUS[st].bg, color: STATUS[st].ink } : undefined}>{st ? `${STATUS[st].emoji} ${STATUS[st].label}` : "Pas encore évalué"}</span></div>
              <div role="radiogroup" aria-label={`Que faire de « ${g.title} » ?`} className="flex flex-wrap gap-2">
                {CHOICES.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={c === k} onClick={() => setChoice((x) => ({ ...x, [g.id]: k }))} className={"btn btn-sm " + (c === k ? "bg-ink text-white" : "border-2 border-line bg-white text-ink")}>{label}</button>)}
              </div>
              {c === "replace" && <input className="input" aria-label={`Nouvel objectif à la place de « ${g.title} »`} placeholder="Nouvel objectif" maxLength={200} value={titles[g.id] ?? ""} onChange={(e) => setTitles((x) => ({ ...x, [g.id]: e.target.value }))} />}
            </li>
          ); })}
        </ul>
        <div className="grid gap-2"><strong>Nouveaux objectifs pour le trimestre {next}</strong>
          {news.map((n, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <select className="input !w-auto" aria-label="Domaine" value={n.axis} onChange={(e) => setNews((l) => l.map((x, j) => (j === i ? { ...x, axis: e.target.value } : x)))}>{AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
              <input className="input min-w-52 flex-1" aria-label="Nouvel objectif" maxLength={200} placeholder="Nouvel objectif" value={n.title} onChange={(e) => setNews((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <button type="button" className="btn-outline btn-sm" onClick={() => setNews((l) => l.filter((_, j) => j !== i))} aria-label="Retirer ce nouvel objectif">✕</button>
            </div>
          ))}
          <button type="button" className="btn-outline btn-sm self-start" onClick={() => setNews((l) => [...l, { axis: "TECHNIQUE", title: "" }])}>+ Ajouter un nouvel objectif</button>
        </div>
        <div className="flex flex-wrap items-center gap-3"><button className="btn-clay" disabled={busy} onClick={apply}>{busy ? "Préparation…" : `Préparer le trimestre ${next}`}</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}{msg?.ok && <button className="btn-outline btn-sm" onClick={onNext}>Voir le trimestre {next}</button>}</div>
      </div>
    </details>
  );
}

function Objectifs({ p }: { p: Player }) {
  const [season, setSeason] = useState(currentSeason());
  const [t, setT] = useState(trimesterOf());
  const [goals, setGoals] = useState<Goal[]>([]);
  const load = useCallback(() => { get<Goal[]>(`/players/${p.id}/goals?season=${season}`).then(setGoals); }, [p.id, season]);
  useEffect(load, [load]);
  const y = Number(currentSeason().slice(0, 4));
  const seasons = [`${y - 1}-${y}`, `${y}-${y + 1}`, `${y + 1}-${y + 2}`];
  const here = goals.filter((g) => goalApplies(g, t));

  async function add(axis: string) { await post(`/players/${p.id}/goals`, { season, axis, title: "Nouvel objectif", trimesters: [t] }); load(); }
  async function upd(g: Goal, body: Partial<Goal>) { setGoals((l) => l.map((x) => (x.id === g.id ? { ...x, ...body } : x))); await patch(`/goals/${g.id}`, body); }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="season">Saison</label>
        <select id="season" className="input !w-auto" value={season} onChange={(e) => setSeason(e.target.value)}>{seasons.map((s) => <option key={s} value={s}>Saison {s.replace("-", "/")}</option>)}</select>
        <label className="sr-only" htmlFor="obj-t">Trimestre</label>
        <select id="obj-t" className="input !w-auto" value={t} onChange={(e) => setT(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>Trimestre {n}</option>)}</select>
        <p className="m-0 font-bold">{here.length === 0 ? "Aucun objectif à travailler ce trimestre" : `${here.length} objectif${here.length > 1 ? "s" : ""} à travailler au trimestre ${t}`}</p>
      </div>
      <p className="hint m-0">Ici, tu <strong>fixes</strong> les objectifs du joueur et tu choisis les trimestres où ils sont à travailler (rien de coché = toute la saison). Pour les <strong>évaluer</strong> (statut, avancement, commentaire) à la fin du trimestre, va dans l'onglet <strong>Évaluations</strong>.</p>
      {t < 3 && <PrepareNext key={`${season}-${t}`} p={p} season={season} t={t} goals={goals} onDone={load} onNext={() => setT(t + 1)} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {AXES.map((a) => {
          const mine = goals.filter((g) => g.axis === a.key);
          return (
            <section key={a.key} className="card grid gap-3 border-t-[6px]" style={{ borderTopColor: a.color }} aria-label={a.label}>
              <h3 className="m-0" style={{ color: a.color }}>{a.label}</h3>
              {mine.map((g) => (
                <article key={g.id} className={"grid gap-2 rounded-xl border border-line bg-chalk p-3 " + (goalApplies(g, t) ? "" : "opacity-70")}>
                  <input className="input" aria-label="Objectif" defaultValue={g.title} maxLength={200} onBlur={(e) => e.target.value !== g.title && upd(g, { title: e.target.value })} />
                  <input className="input" aria-label="Comment le mesure-t-on ?" placeholder="Comment le mesure-t-on ?" defaultValue={g.indicator} maxLength={200} onBlur={(e) => e.target.value !== g.indicator && upd(g, { indicator: e.target.value })} />
                  <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"><legend className="mb-1 text-sm font-bold">À travailler au</legend>
                    {[1, 2, 3].map((n) => (
                      <label key={n} className="flex min-h-10 items-center gap-2 rounded-full border-2 border-line bg-white px-3 text-sm font-semibold has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
                        <input type="checkbox" className="accent-clay" checked={g.trimesters?.includes(n) ?? false} onChange={(e) => upd(g, { trimesters: e.target.checked ? [...(g.trimesters ?? []), n].sort() : (g.trimesters ?? []).filter((x) => x !== n) })} />T{n}
                      </label>
                    ))}
                    {!g.trimesters?.length && <span className="hint">Toute la saison</span>}
                  </fieldset>
                  {goalApplies(g, t) ? (
                    <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
                      {isCarriedOver(g, t) && <span className="font-bold text-[#5b21b6]">🔁 Reconduit depuis le trimestre {t - 1}</span>}
                      <span className="badge" style={statusAt(g, t) ? { background: STATUS[statusAt(g, t)!].bg, color: STATUS[statusAt(g, t)!].ink } : undefined}>{statusAt(g, t) ? `${STATUS[statusAt(g, t)!].emoji} ${STATUS[statusAt(g, t)!].label} au T${t}` : `Pas encore évalué au T${t}`}</span>
                    </p>
                  ) : <p className="hint m-0">Cet objectif n'est pas prévu au trimestre {t}.</p>}
                  <button className="btn-danger btn-sm self-start" onClick={async () => { if (confirm("Supprimer cet objectif et son historique ?")) { await del(`/goals/${g.id}`); load(); } }}>Supprimer</button>
                </article>
              ))}
              <button className="btn-outline btn-sm self-start" onClick={() => add(a.key)}>+ Ajouter un objectif</button>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PlayerVideosTab({ p }: { p: Player }) {
  const [version, setVersion] = useState(0);
  const videos = (useVideos(version) ?? []).filter((v) => v.player?.id === p.id);
  const imageOk = !!p.consents?.some((c) => c.kind === "IMAGE" && !c.withdrawnAt);
  return (
    <div className="grid gap-4">
      {!imageOk && <p className="alert m-0"><strong>Accord « droit à l'image » manquant.</strong> Aucune vidéo de ce joueur ne peut être envoyée tant que l'accord des parents n'est pas enregistré (onglet « Accords et famille »). Si l'accord est retiré plus tard, les vidéos du joueur sont supprimées.</p>}
      {imageOk && <VideoUpload playerId={p.id} onDone={() => setVersion((n) => n + 1)} />}
      <ul className="m-0 grid list-none gap-3 p-0">
        {videos.map((v) => (
          <li key={v.id}><Link to={`/coach/videos/${v.id}`} className="card flex flex-wrap items-center justify-between gap-2 no-underline hover:shadow-md"><span><strong>{v.title}</strong><small className="hint block">{v.shot} · {fmtDate(v.recordedAt)}{v.question ? " · avec une question" : ""}</small></span><VideoBadge v={v} /></Link></li>
        ))}
        {!videos.length && <li><Empty>Aucune vidéo pour ce joueur.</Empty></li>}
      </ul>
    </div>
  );
}

export default function PlayerDetail() {
  const { id = "" } = useParams();
  const [p, setP] = useState<Player | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("profil");
  const load = useCallback(() => { get<Player>(`/players/${id}`).then(setP).catch(() => setMissing(true)); }, [id]);
  useEffect(load, [load]);
  if (missing) return <Page><Empty>Ce joueur est introuvable.</Empty><Link to="/coach/centre" className="btn-clay no-underline">Retour</Link></Page>;
  if (!p) return <p className="p-8 text-center text-muted">Chargement…</p>;
  const tabs: [Tab, string][] = [["profil", "Profil"], ["accords", "Accords et famille"], ["objectifs", "Objectifs"], ["evaluations", "Évaluations"], ["videos", "Vidéos"], ["matchs", "Matchs"], ["bulletins", "Bulletins"]];
  return (
    <>
      <PageHead eyebrow="Dossier du joueur" title={fullName(p)}>
        <div className="flex flex-wrap items-center gap-3"><Link to="/coach/centre" className="font-bold text-ink underline">← Tous mes joueurs</Link><Link to={`/coach/centre/${p.id}/apercu`} className="btn-ink btn-sm no-underline">👀 Voir comme le jeune</Link></div>
      </PageHead>
      <Page>
        <div role="tablist" aria-label="Sections du dossier" className="flex gap-1 overflow-x-auto border-b-2 border-line">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={"min-h-12 whitespace-nowrap border-b-4 px-4 font-bold " + (tab === k ? "border-clay text-clay" : "border-transparent text-muted")}>{label}</button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "profil" && <Profil p={p} onSaved={load} />}
          {tab === "accords" && <Accords p={p} onChanged={load} />}
          {tab === "objectifs" && <Objectifs p={p} />}
          {tab === "evaluations" && <Evaluations p={p} />}
          {tab === "videos" && <PlayerVideosTab p={p} />}
          {tab === "matchs" && <Matchs p={p} />}
          {tab === "bulletins" && <Bulletins p={p} />}
        </div>
      </Page>
    </>
  );
}
