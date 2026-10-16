import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { AuthorBadge, Err, Field } from "./ui";
import { MailFamilyBar } from "./MailParent";
import { fmtPeriod, Goal, missionOfTheme, RANKINGS, REPORT_AXES, REPORT_FEELINGS, REPORT_LEVELS, REPORT_THEMES, ReportLevel, ReportMatch, reportStarsOf, todayIso, TournamentReport } from "../types";

// Bilan de tournoi : l'entraîneur (ou le coach) saisit les matchs, comment ça s'est passé, thème par thème, un petit mot ; le COACH valide.
// Avant la validation : invisible du jeune et de sa famille. À la validation : le bilan devient visible, les matchs entrent dans le bulletin et les étoiles « en match » (×2) sont données.
const themeLabel = (k: string) => REPORT_THEMES.find((t) => t.key === k)?.label ?? k;
const wellOf = (r: Pick<TournamentReport, "themes">) => REPORT_THEMES.filter((t) => r.themes[t.key] && (r.themes[t.key].level === "bien" || r.themes[t.key].level === "tres-bien"));
const workOf = (r: Pick<TournamentReport, "themes">) => REPORT_THEMES.filter((t) => r.themes[t.key]?.level === "a-travailler");
const feelOf = (n: number) => REPORT_FEELINGS.find((f) => f.n === n);

// ----- Le contenu d'un bilan (lecture) -----
export function ReportBody({ r }: { r: Pick<TournamentReport, "matches" | "themes" | "feeling" | "summary"> }) {
  const f = feelOf(r.feeling), well = wellOf(r), work = workOf(r), stars = reportStarsOf(r);
  const wins = r.matches.filter((m) => m.result === "Victoire").length;
  return (
    <div className="grid gap-2 text-[0.95rem]">
      <p className="m-0"><strong>{f?.emoji} {f?.label}</strong> · {wins} victoire{wins > 1 ? "s" : ""}, {r.matches.length - wins} défaite{r.matches.length - wins > 1 ? "s" : ""}</p>
      <ul className="m-0 grid list-none gap-1 p-0">
        {r.matches.map((m, i) => <li key={i}>{m.result === "Victoire" ? "🏆" : "😕"} {fmtPeriod(m.day, m.day)}{m.round ? ` · ${m.round}` : ""}{m.score ? ` · ${m.score}` : ""}{m.opponentRanking ? ` · adversaire ${m.opponentRanking}` : ""}</li>)}
      </ul>
      {well.length > 0 && <p className="m-0"><strong>👍 Ce qui était bien :</strong> {well.map((t) => `${t.label}${r.themes[t.key].level === "tres-bien" ? " (très bien)" : ""}`).join(", ")}</p>}
      {work.length > 0 && <p className="m-0"><strong>🎯 À travailler :</strong> {work.map((t) => t.label).join(", ")}</p>}
      {r.summary && <p className="m-0">💬 « {r.summary} »</p>}
      {stars > 0 && <p className="m-0 font-bold">⭐ {stars} étoile{stars > 1 ? "s" : ""} en match (×2)</p>}
    </div>
  );
}

// ----- Le formulaire -----
const LEVEL_BTN = REPORT_LEVELS.filter((l) => l.key);
export function ReportForm({ p, initial, preview = false, goals: goalsProp, onDone, onCancel }: { p: { id: string; firstName: string }; initial?: TournamentReport; preview?: boolean; goals?: Goal[]; onDone: () => void; onCancel: () => void }) {
  const [goals, setGoals] = useState<Goal[]>(goalsProp ?? []);
  useEffect(() => { if (!goalsProp && !preview) get<Goal[]>(`/players/${p.id}/goals`).then(setGoals).catch(() => setGoals([])); }, [goalsProp, preview, p.id]);
  const today = todayIso();
  const [name, setName] = useState(initial?.name ?? "");
  const [from, setFrom] = useState(initial?.dateFrom ?? today);
  const [to, setTo] = useState(initial?.dateTo ?? today);
  const [feeling, setFeeling] = useState(initial?.feeling ?? 0);
  const [matches, setMatches] = useState<ReportMatch[]>(initial?.matches ?? [{ day: today, round: "", result: "Victoire", score: "", opponentRanking: "" }]);
  const [themes, setThemes] = useState<Record<string, ReportLevel>>(() => Object.fromEntries(Object.entries(initial?.themes ?? {}).map(([k, v]) => [k, v.level])));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [note, setNote] = useState("");
  const setMatch = (i: number, patch: Partial<ReportMatch>) => setMatches((l) => l.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const pick = (k: string, lvl: ReportLevel) => setThemes((t) => { const n = { ...t }; if (n[k] === lvl) delete n[k]; else n[k] = lvl; return n; });
  const total = Object.values(themes).reduce((n, l) => n + (l === "bien" ? 2 : l === "tres-bien" ? 4 : 0), 0);

  async function save(e: FormEvent) {
    e.preventDefault(); setErr(""); setNote("");
    if (name.trim().length < 2) return setErr("Écris le nom du tournoi.");
    if (to < from) return setErr("La date de fin est avant la date de début.");
    if (!feeling) return setErr("Choisis comment ça s'est passé (Difficile, Moyen, Bien ou Très bien).");
    if (!matches.length) return setErr("Ajoute au moins un match.");
    if (!Object.keys(themes).length) return setErr("Choisis au moins un thème (À travailler, Bien ou Très bien).");
    if (preview) return setNote("👀 Aperçu : rien n'est enregistré. En vrai, le bilan part chez le coach, qui le relit et le valide.");
    const body = {
      name: name.trim(), dateFrom: from, dateTo: to, feeling, summary: summary.trim(),
      matches: matches.map((m) => ({ day: m.day, round: m.round.trim(), result: m.result, score: m.score.trim(), ...(m.opponentRanking ? { opponentRanking: m.opponentRanking } : {}) })),
      themes: Object.fromEntries(Object.entries(themes).map(([k, level]) => { const g = level === "a-travailler" ? undefined : missionOfTheme(goals, themeLabel(k), to); return [k, g ? { level, goalId: g.id } : { level }]; })),
    };
    setBusy(true);
    try { if (initial) await put(`/players/${p.id}/tournament-reports/${initial.id}`, body); else await post(`/players/${p.id}/tournament-reports`, body); onDone(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="card grid gap-4" noValidate aria-label={`Bilan de tournoi de ${p.firstName}`}>
      <h3 className="m-0">🏆 {initial ? "Corriger le bilan" : "Bilan de tournoi"} · {p.firstName}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tournoi" id="r-name"><input id="r-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tournoi jeunes de Dreux" /></Field>
        <Field label="Du" id="r-from"><input id="r-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Au" id="r-to"><input id="r-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>

      <section className="grid gap-2" aria-label="Les matchs">
        <h4 className="m-0">Les matchs et les scores</h4>
        {matches.map((m, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border-2 border-line bg-white p-3 sm:grid-cols-5">
            <Field label="Date" id={`m-d${i}`}><input id={`m-d${i}`} type="date" className="input" value={m.day} onChange={(e) => setMatch(i, { day: e.target.value })} /></Field>
            <Field label="Résultat" id={`m-r${i}`}><select id={`m-r${i}`} className="input" value={m.result} onChange={(e) => setMatch(i, { result: e.target.value as ReportMatch["result"] })}><option>Victoire</option><option>Défaite</option></select></Field>
            <Field label="Score" id={`m-s${i}`}><input id={`m-s${i}`} className="input" maxLength={40} value={m.score} onChange={(e) => setMatch(i, { score: e.target.value })} placeholder="6-4 3-6 7-5" /></Field>
            <Field label="Classement adverse" id={`m-k${i}`}><select id={`m-k${i}`} className="input" value={m.opponentRanking ?? ""} onChange={(e) => setMatch(i, { opponentRanking: e.target.value })}><option value="">Non renseigné</option>{RANKINGS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
            <div className="grid content-end gap-1">
              <Field label="Tour (facultatif)" id={`m-t${i}`}><input id={`m-t${i}`} className="input" maxLength={40} value={m.round} onChange={(e) => setMatch(i, { round: e.target.value })} placeholder="Finale" /></Field>
              {matches.length > 1 && <button type="button" className="btn-danger btn-sm" onClick={() => setMatches((l) => l.filter((_, j) => j !== i))}>Retirer ce match</button>}
            </div>
          </div>
        ))}
        {matches.length < 12 && <button type="button" className="btn-outline btn-sm justify-self-start" onClick={() => setMatches((l) => [...l, { day: to, round: "", result: "Victoire", score: "", opponentRanking: "" }])}>+ Ajouter un match</button>}
      </section>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 font-display font-bold">Comment ça s'est passé ?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REPORT_FEELINGS.map((f) => <button key={f.n} type="button" aria-pressed={feeling === f.n} onClick={() => setFeeling(f.n)} className={"min-h-12 rounded-xl border-2 px-2 font-bold " + (feeling === f.n ? "border-[#2f8f5b] bg-[#2f8f5b] text-white" : "border-ink bg-white")}>{f.emoji} {f.label}</button>)}
        </div>
      </fieldset>

      <section className="grid gap-3" aria-label="Thème par thème">
        <div>
          <h4 className="m-0">Thème par thème</h4>
          <p className="hint m-0">Touche un niveau (touche encore pour l'enlever). <strong>Bien = +2 ⭐</strong> et <strong>Très bien = +4 ⭐</strong> (étoiles doublées en match) sur la mission du même thème ; sans mission, l'étoile va « hors mission » dans le domaine. <strong>À travailler</strong> ne retire jamais d'étoile : le thème est noté dans « À travailler ».</p>
        </div>
        {REPORT_AXES.map((ax) => (
          <details key={ax.key} open={ax.key === "technique"} className="rounded-2xl border-2 border-line bg-white p-3">
            <summary className="cursor-pointer font-bold">{ax.emoji} {ax.label} <small className="font-normal text-muted">({REPORT_THEMES.filter((t) => t.axis === ax.key && themes[t.key]).length} noté{REPORT_THEMES.filter((t) => t.axis === ax.key && themes[t.key]).length > 1 ? "s" : ""})</small></summary>
            <div className="mt-2 grid gap-2">
              {REPORT_THEMES.filter((t) => t.axis === ax.key).map((t) => {
                const lvl = themes[t.key], g = lvl && lvl !== "a-travailler" ? missionOfTheme(goals, t.label, to) : undefined, st = lvl === "bien" ? 2 : lvl === "tres-bien" ? 4 : 0;
                return (
                  <div key={t.key} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:items-center" role="group" aria-label={t.label}>
                    <strong>{t.label}</strong>
                    <div className="grid gap-1">
                      <div className="grid grid-cols-3 gap-1.5">
                        {LEVEL_BTN.map((l) => <button key={l.key} type="button" aria-pressed={lvl === l.key} onClick={() => pick(t.key, l.key as ReportLevel)} className={"min-h-11 rounded-xl border-2 px-1 text-sm font-bold " + (lvl === l.key ? (l.key === "a-travailler" ? "border-[#e08a00] bg-[#e08a00] text-white" : "border-[#2f8f5b] bg-[#2f8f5b] text-white") : "border-ink bg-white")}>{l.label}{l.stars ? ` · +${l.stars} ⭐` : ""}</button>)}
                      </div>
                      {st > 0 && <small className="text-muted">{g ? `→ +${st} ⭐ sur la mission « ${g.title} »` : `→ +${st} ⭐ hors mission (${ax.label})`}</small>}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
        <p className="m-0 font-bold" role="status">⭐ Total prévu : {total} étoile{total > 1 ? "s" : ""} (données à la validation du coach)</p>
      </section>

      <Field label="Le petit mot de bilan (300 caractères maximum, ton bienveillant)" id="r-sum"><textarea id="r-sum" className="input min-h-24" maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Beau tournoi ! Service et combativité au top. On travaille le retour pour la prochaine fois." /></Field>
      <Err msg={err} />
      {note && <p role="status" className="alert m-0">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-clay" disabled={busy}>{busy ? "Envoi…" : initial ? "Enregistrer les corrections" : "Envoyer le bilan au coach"}</button>
        <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

// ----- Un bilan dans la liste (personnel) : voir, corriger, valider, imprimer, supprimer -----
// asRole : pour l'aperçu du coach « voir comme l'entraîneur de comité » (rien n'est envoyé au serveur)
export function ReportItem({ r, p, onChanged, preview = false, asRole }: { r: TournamentReport; p: { id: string; firstName: string }; onChanged: () => void; preview?: boolean; asRole?: "COACH" | "TRAINER" }) {
  const { me } = useAuth();
  const role = asRole ?? me?.role, isCoach = role === "COACH", mine = asRole ? asRole === "TRAINER" : !!me && r.authorId === me.id;
  const [edit, setEdit] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const canEdit = r.status === "SUBMITTED" && (isCoach || mine), canDelete = isCoach || (r.status === "SUBMITTED" && mine);
  async function run(fn: () => Promise<unknown>) { setErr(""); setBusy(true); try { await fn(); onChanged(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }
  if (edit) return <ReportForm p={p} initial={r} preview={preview} onDone={() => { setEdit(false); onChanged(); }} onCancel={() => setEdit(false)} />;
  const stars = reportStarsOf(r);
  return (
    <article className="card grid gap-3" style={{ borderLeft: `8px solid ${r.status === "VALIDATED" ? "#2f8f5b" : "#e08a00"}` }}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-lg">🏆 {r.name}</h3>
        <span className="text-sm text-muted">{fmtPeriod(r.dateFrom, r.dateTo)}</span>
        <span className={"rounded-full px-2.5 py-0.5 text-xs font-bold " + (r.status === "VALIDATED" ? "bg-[#e6f4ea] text-[#1c6b3a]" : "bg-[#fff3b0] text-[#6b4e00]")}>{r.status === "VALIDATED" ? "✅ Validé · visible de la famille" : "⏳ À valider par le coach"}</span>
        <AuthorBadge a={r} />
      </div>
      <ReportBody r={r} />
      <Err msg={err} />
      <div className="flex flex-wrap gap-2">
        {r.status === "SUBMITTED" && isCoach && <button className="btn-clay btn-sm" disabled={busy} onClick={() => { if (confirm(`Valider ce bilan ?\n\n• la famille le verra\n• ${r.matches.length} match${r.matches.length > 1 ? "s" : ""} entre${r.matches.length > 1 ? "nt" : ""} dans le bulletin\n• ${stars} étoile${stars > 1 ? "s" : ""} en match seront données`)) run(() => preview ? Promise.resolve() : post(`/players/${r.playerId}/tournament-reports/${r.id}/validate`)); }}>✅ Valider</button>}
        {canEdit && <button className="btn-outline btn-sm" onClick={() => setEdit(true)}>✏️ {isCoach ? "Relire / corriger" : "Corriger"}</button>}
        {isCoach && !preview && <Link className="btn-outline btn-sm no-underline" to={`/coach/centre/${r.playerId}/bilan-tournoi/${r.id}`} target="_blank">🖨️ Version imprimable / PDF</Link>}
        {canDelete && <button className="btn-danger btn-sm" disabled={busy} onClick={() => { if (confirm(r.status === "VALIDATED" ? "Supprimer ce bilan VALIDÉ ? Ses matchs et ses étoiles seront aussi supprimés." : "Supprimer ce bilan ?")) run(() => preview ? Promise.resolve() : del(`/players/${r.playerId}/tournament-reports/${r.id}`)); }}>Supprimer</button>}
      </div>
      {r.status === "SUBMITTED" && !isCoach && <p className="hint m-0">Ce bilan est chez le coach. Il le relit et le valide : tant qu'il ne l'a pas fait, le jeune et sa famille ne voient rien et aucune étoile n'est donnée.</p>}
    </article>
  );
}

// ----- Sur la fiche d'un joueur (onglet Matchs) : ses bilans + « Faire le bilan d'un tournoi » -----
export function PlayerReports({ p }: { p: { id: string; firstName: string } }) {
  const [list, setList] = useState<TournamentReport[] | null>(null);
  const [open, setOpen] = useState(false);
  const { me } = useAuth();
  const load = useCallback(() => { get<TournamentReport[]>(`/players/${p.id}/tournament-reports`).then(setList).catch(() => setList([])); }, [p.id]);
  useEffect(load, [load]);
  return (
    <section className="grid gap-3" aria-labelledby="rep-titre">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="rep-titre" className="m-0">🏆 Bilans de tournoi</h3>
        {!open && <button className="btn-clay btn-sm" onClick={() => setOpen(true)}>Faire le bilan d'un tournoi</button>}
      </div>
      {open && <ReportForm p={p} onDone={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />}
      {me?.role === "COACH" && (list ?? []).some((r) => r.status === "VALIDATED") && <MailFamilyBar playerId={p.id} firstName={p.firstName} topic="bilan" />}
      {list === null ? <p className="hint m-0">Chargement…</p> : list.length === 0 ? !open && <p className="hint m-0">Aucun bilan de tournoi pour l'instant.</p> : list.map((r) => <ReportItem key={r.id} r={r} p={p} onChanged={load} />)}
    </section>
  );
}

// ----- Chez le coach : « 🏆 Bilans de tournoi » à valider (onglet du Centre) -----
export function usePendingReports() {
  const [list, setList] = useState<TournamentReport[] | null>(null);
  const load = useCallback(() => { get<TournamentReport[]>("/tournament-reports/pending").then(setList).catch(() => setList([])); }, []);
  useEffect(load, [load]);
  return { list, load };
}
export function PendingReports({ list, onChanged }: { list: TournamentReport[] | null; onChanged: () => void }) {
  if (list === null) return <p className="hint m-0">Chargement…</p>;
  return (
    <div className="grid gap-3">
      <p className="hint m-0">Les bilans remplis par les entraîneurs arrivent ici. Tu relis, tu corriges si besoin, puis tu valides : <strong>alors seulement</strong> la famille les voit, les matchs entrent dans le bulletin et les étoiles (×2) sont données. Ensuite tu préviens la famille par e-mail depuis l'onglet « Matchs » du joueur.</p>
      {list.length === 0 && <p className="card m-0">Aucun bilan à valider. 🎉</p>}
      {list.map((r) => <div key={r.id} className="grid gap-1"><strong>{r.player?.firstName} {r.player?.lastName}</strong><ReportItem r={r} p={{ id: r.playerId, firstName: r.player?.firstName ?? "" }} onChanged={onChanged} /></div>)}
    </div>
  );
}

// ----- Chez le jeune et sa famille (onglet « Mes matchs ») : seulement les bilans validés -----
export function ChildReports({ playerId }: { playerId: string }) {
  const [list, setList] = useState<TournamentReport[]>([]);
  useEffect(() => { get<TournamentReport[]>(`/players/${playerId}/tournament-reports`).then(setList).catch(() => setList([])); }, [playerId]);
  if (!list.length) return null;
  return (
    <section className="glass grid gap-3" aria-labelledby="child-rep">
      <h2 id="child-rep" className="m-0 text-2xl">🏆 Les bilans de mes tournois</h2>
      {list.map((r) => {
        const f = feelOf(r.feeling), well = wellOf(r), work = workOf(r), stars = reportStarsOf(r);
        return (
          <article key={r.id} className="grid gap-2 rounded-2xl border-2 border-white/50 bg-white/10 p-4 text-white">
            <h3 className="m-0 text-xl">{r.name} <small className="font-normal text-white/80">· {fmtPeriod(r.dateFrom, r.dateTo)}</small></h3>
            <p className="m-0">{f?.emoji} <strong>{f?.label}</strong></p>
            {well.length > 0 && <p className="m-0"><strong>👍 Ce qui était bien :</strong> {well.map((t) => t.label).join(", ")}</p>}
            {work.length > 0 && <p className="m-0"><strong>🎯 On travaille :</strong> {work.map((t) => t.label).join(", ")}</p>}
            {r.summary && <p className="m-0">💬 « {r.summary} »</p>}
            {stars > 0 && <p className="m-0 font-bold">⭐ +{stars} étoile{stars > 1 ? "s" : ""} gagnée{stars > 1 ? "s" : ""} en match <span className="rounded-full bg-[#dcf247] px-2 py-0.5 text-xs text-[#10203a]">⚔️ ×2</span></p>}
            <ul className="m-0 grid list-none gap-0.5 p-0 text-sm text-white/90">{r.matches.map((m, i) => <li key={i}>{m.result === "Victoire" ? "🏆" : "😕"} {m.score || m.result}{m.opponentRanking ? ` · adversaire ${m.opponentRanking}` : ""}</li>)}</ul>
          </article>
        );
      })}
    </section>
  );
}

export function ReportTag({ children }: { children?: ReactNode }) { return <span className="rounded-full bg-[#dcf247] px-2 py-0.5 text-xs font-extrabold text-[#10203a]">{children ?? "⚔️ En match ×2"}</span>; }
