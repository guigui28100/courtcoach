import { FormEvent, useState } from "react";
import { del, get, post, put } from "../api";
import { useEffect, useCallback } from "react";
import { DeclaredMatch, FEELINGS, fmtDate, matchLabel, MATCH_KINDS, MATCH_OPPONENTS, MATCH_SKILLS, Player, RANKINGS, todayIso } from "../types";

export function useDeclaredMatches(playerId: string | undefined, enabled = true) {
  const [list, setList] = useState<DeclaredMatch[] | null>(null);
  const load = useCallback(() => { if (playerId && enabled) get<DeclaredMatch[]>(`/players/${playerId}/declared-matches`).then(setList).catch(() => setList([])); }, [playerId, enabled]);
  useEffect(load, [load]);
  return { list, reload: load };
}

const pill = (on: boolean) => "min-h-11 rounded-full border-2 px-4 py-1.5 text-left font-bold transition-colors " + (on ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/40 bg-white/10 text-white hover:bg-white/20");

// Formulaire de déclaration d'un match : surtout des boutons, aucun nom d'adversaire
function MatchForm({ p, initial, onDone, preview }: { p: Player; initial?: DeclaredMatch; onDone: () => void; preview?: boolean }) {
  const [day, setDay] = useState(initial?.day ?? todayIso());
  const [kind, setKind] = useState(initial?.kind ?? "");
  const [event, setEvent] = useState(initial?.event ?? "");
  const [result, setResult] = useState<string>(initial?.result ?? "");
  const [score, setScore] = useState(initial?.score ?? "");
  const [opponent, setOpponent] = useState(initial?.opponent ?? "");
  const [ranking, setRanking] = useState(initial?.opponentRanking ?? "");
  const [feeling, setFeeling] = useState(initial?.feeling ?? 0);
  const [well, setWell] = useState<string[]>(initial?.wellDone ?? []);
  const [improve, setImprove] = useState<string>(initial?.toImprove ?? "");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const ready = kind && result && opponent && feeling > 0;
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (preview) return setMsg("👀 Aperçu : rien n'est enregistré (c'est le jeune qui déclare ses matchs).");
    if (!ready) return setMsg("⚠️ Choisis le type de match, le résultat, le niveau de l'adversaire et ton ressenti.");
    setBusy(true);
    try {
      const body = { day, kind, event: event.trim() || undefined, result, score: score.trim() || undefined, opponent, feeling, wellDone: well, toImprove: improve || undefined, opponentRanking: ranking || undefined };
      if (initial) await put(`/players/${p.id}/declared-matches/${initial.id}`, body); else await post(`/players/${p.id}/declared-matches`, body);
      onDone();
    } catch (x) { setMsg("⚠️ " + (x as Error).message); } finally { setBusy(false); }
  }
  const step = (n: number, t: string) => <h4 className="m-0 text-base"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-[#dcf247] text-xs font-black text-ink" aria-hidden="true">{n}</span>{t}</h4>;
  return (
    <form onSubmit={save} className="grid gap-4 rounded-2xl bg-white/10 p-4" noValidate>
      <div className="grid gap-2">{step(1, "Quel match ?")}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de match">{MATCH_KINDS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={pill(kind === k)} onClick={() => setKind(k)}>{l}</button>)}</div>
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm font-bold">Date<input type="date" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} className="input !w-auto text-ink" /></label>
          <label className="grid min-w-52 flex-1 gap-1 text-sm font-bold">Nom du tournoi ou du lieu (facultatif)<input value={event} maxLength={60} onChange={(e) => setEvent(e.target.value)} className="input text-ink" placeholder="Plateau de Dreux" /></label>
        </div>
      </div>
      <div className="grid gap-2">{step(2, "Comment ça s'est terminé ?")}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Résultat">{(["Victoire", "Défaite"] as const).map((r) => <button key={r} type="button" role="radio" aria-checked={result === r} className={pill(result === r)} onClick={() => setResult(r)}>{r === "Victoire" ? "🏆 Victoire" : "😕 Défaite"}</button>)}</div>
        <label className="grid gap-1 text-sm font-bold">Score (facultatif)<input value={score} maxLength={40} onChange={(e) => setScore(e.target.value)} className="input !w-52 text-ink" placeholder="6/3 4/6 10/8" /></label>
      </div>
      <div className="grid gap-2">{step(3, "Ton adversaire était…")}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Niveau de l'adversaire">{MATCH_OPPONENTS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={opponent === k} className={pill(opponent === k)} onClick={() => setOpponent(k)}>{l}</button>)}</div>
        <label className="grid gap-1 text-sm font-bold">Son classement (facultatif)<select value={ranking} onChange={(e) => setRanking(e.target.value)} className="input !w-52 text-ink"><option value="">Je ne sais pas</option>{RANKINGS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <small className="text-white/70">Pas de nom, s'il te plaît : seulement son niveau et son classement.</small>
      </div>
      <div className="grid gap-2">{step(4, "Comment as-tu joué ?")}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ton ressenti">{FEELINGS.map(([e, t], i) => <button key={t} type="button" role="radio" aria-checked={feeling === i + 1} onClick={() => setFeeling(i + 1)} className={"grid min-h-14 min-w-[4.5rem] justify-items-center rounded-2xl border-2 px-2 py-1 text-sm font-bold " + (feeling === i + 1 ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/40 bg-white/10 text-white hover:bg-white/20")}><span className="text-2xl" aria-hidden="true">{e}</span>{t}</button>)}</div>
      </div>
      <div className="grid gap-2">{step(5, "Ce qui a bien marché (2 au maximum)")}
        <div className="flex flex-wrap gap-2">{MATCH_SKILLS.map(([k, l]) => { const on = well.includes(k); return <button key={k} type="button" aria-pressed={on} disabled={!on && well.length >= 2} className={pill(on) + " disabled:opacity-40"} onClick={() => setWell(on ? well.filter((x) => x !== k) : [...well, k])}>{on ? "✓ " : ""}{l}</button>; })}</div>
      </div>
      <div className="grid gap-2">{step(6, "Ce que je veux améliorer (1 choix)")}
        <div className="flex flex-wrap gap-2">{MATCH_SKILLS.map(([k, l]) => <button key={k} type="button" aria-pressed={improve === k} className={pill(improve === k)} onClick={() => setImprove(improve === k ? "" : k)}>{improve === k ? "✓ " : ""}{l}</button>)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="gal-btn" disabled={busy}>{initial ? "💾 Enregistrer les changements" : "✅ Enregistrer ce match"}</button>
        <button type="button" className="btn btn-sm border-2 border-white/60 text-white hover:bg-white hover:text-ink" onClick={onDone}>Annuler</button>
        {msg && <p role="status" className="m-0 font-bold text-[#dcf247]">{msg}</p>}
      </div>
    </form>
  );
}

function MatchCard({ m, p, onChanged, preview }: { m: DeclaredMatch; p: Player; onChanged: () => void; preview?: boolean }) {
  const [edit, setEdit] = useState(false);
  if (edit) return <li className="list-none"><MatchForm p={p} initial={m} preview={preview} onDone={() => { setEdit(false); onChanged(); }} /></li>;
  const left = Math.max(0, Math.ceil((new Date(m.editableUntil).getTime() - Date.now()) / 86400000));
  return (
    <li className="grid gap-1.5 rounded-2xl bg-white/10 p-3">
      <span className="flex flex-wrap items-center justify-between gap-2"><strong>{matchLabel(MATCH_KINDS, m.kind)}{m.event && ` · ${m.event}`}</strong><span className={"gal-chip " + (m.result === "Victoire" ? "!bg-[#dcf247] !text-ink" : "")}>{m.result === "Victoire" ? "🏆 Victoire" : "😕 Défaite"}</span></span>
      <span className="text-sm text-white/85">{fmtDate(m.day)}{m.score && ` · ${m.score}`} · adversaire : {matchLabel(MATCH_OPPONENTS, m.opponent).replace(/^\S+\s/, "").toLowerCase()}{m.opponentRanking && ` (${m.opponentRanking})`} · {FEELINGS[m.feeling - 1]?.[0]} {FEELINGS[m.feeling - 1]?.[1]}</span>
      {(m.wellDone.length > 0 || m.toImprove) && <span className="text-sm text-white/85">{m.wellDone.length > 0 && <>⭐ Bien : {m.wellDone.map((k) => matchLabel(MATCH_SKILLS, k).toLowerCase()).join(", ")}. </>}{m.toImprove && <>🎯 À améliorer : {matchLabel(MATCH_SKILLS, m.toImprove).toLowerCase()}.</>}</span>}
      {m.coachComment && <span className="rounded-xl bg-[#dcf247] p-2 text-sm font-bold text-ink">💬 Ton coach : {m.coachComment}</span>}
      <span className="flex flex-wrap items-center gap-2 text-sm">
        {m.editable ? (<>
          <button type="button" className="btn btn-sm border-2 border-white/60 text-white hover:bg-white hover:text-ink" onClick={() => setEdit(true)}>✏️ Modifier</button>
          <button type="button" className="btn btn-sm border-2 border-[#ff9b9b] text-[#ffb4b4] hover:bg-[#b3261e] hover:text-white" onClick={async () => { if (confirm("Supprimer ce match ?")) { if (preview) return; await del(`/players/${p.id}/declared-matches/${m.id}`); onChanged(); } }}>Supprimer</button>
          <small className="text-white/70">Tu peux encore le corriger {left > 1 ? `${left} jours` : "aujourd'hui"}.</small></>) : <small className="text-white/70">🔒 Ce match est enregistré : il ne peut plus être modifié (demande à ton coach si besoin).</small>}
      </span>
    </li>
  );
}

// Section « Mes matchs » de l'espace du jeune
export function DeclaredMatchesSection({ p, preview = false }: { p: Player; preview?: boolean }) {
  const { list, reload } = useDeclaredMatches(p.id);
  const [open, setOpen] = useState(false);
  const wins = (list ?? []).filter((m) => m.result === "Victoire").length;
  return (
    <section className="glass gal-pop grid gap-4" aria-labelledby="gal-mes-matchs">
      <h2 id="gal-mes-matchs" className="m-0 text-2xl">🏟️ Mes matchs</h2>
      <p className="m-0 text-white/85">Note ici tes matchs (tournoi, amical…) : ton résultat, comment tu as joué, ce qui a bien marché. Seuls <strong>toi et ton coach</strong> les voyez. Tu peux corriger un match pendant 7 jours.</p>
      {!open && <div><button type="button" className="gal-btn" onClick={() => setOpen(true)}>+ J'ajoute un match</button></div>}
      {open && <MatchForm p={p} preview={preview} onDone={() => { setOpen(false); reload(); }} />}
      {list === null ? <div className="skeleton h-20" role="status" aria-label="Chargement en cours" /> : list.length === 0 ? <p className="m-0 rounded-2xl bg-white/10 p-3">Aucun match noté pour l'instant. Après ton prochain match, viens le raconter ici !</p> : (
        <>
          <p className="m-0 font-bold">{wins} victoire{wins > 1 ? "s" : ""} · {list.length - wins} défaite{list.length - wins > 1 ? "s" : ""}</p>
          <ul className="m-0 grid gap-2 p-0">{list.map((m) => <MatchCard key={m.id} m={m} p={p} onChanged={reload} preview={preview} />)}</ul>
        </>
      )}
    </section>
  );
}

// Côté coach : les matchs déclarés par le jeune, avec un commentaire
export function CoachDeclaredMatches({ p }: { p: Player }) {
  const { list, reload } = useDeclaredMatches(p.id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (!list || !list.length) return list ? <section className="card grid gap-1"><h3 className="m-0">🏟️ Matchs déclarés par {p.firstName}</h3><p className="hint m-0">Rien pour l'instant : {p.firstName} peut noter ses matchs dans son espace (visibles de lui et de toi seulement, pas de ses parents).</p></section> : null;
  return (
    <section className="card grid gap-3">
      <h3 className="m-0">🏟️ Matchs déclarés par {p.firstName} <small className="font-normal text-muted">· visibles de lui et de toi seulement</small></h3>
      <ul className="m-0 grid list-none gap-3 p-0">
        {list.map((m) => (
          <li key={m.id} className="grid gap-1.5 rounded-xl border border-line p-3">
            <span className="flex flex-wrap items-center justify-between gap-2"><strong>{matchLabel(MATCH_KINDS, m.kind)}{m.event && ` · ${m.event}`}</strong><span className={"badge " + (m.result === "Victoire" ? "!border-ok !text-ok" : "!border-bad !text-bad")}>{m.result}</span></span>
            <small className="hint">{fmtDate(m.day)}{m.score && ` · ${m.score}`} · adversaire {matchLabel(MATCH_OPPONENTS, m.opponent).replace(/^\S+\s/, "").toLowerCase()}{m.opponentRanking && ` (${m.opponentRanking})`} · {FEELINGS[m.feeling - 1]?.[0]} {FEELINGS[m.feeling - 1]?.[1]}</small>
            {(m.wellDone.length > 0 || m.toImprove) && <span className="text-sm">{m.wellDone.length > 0 && <>⭐ Bien : {m.wellDone.map((k) => matchLabel(MATCH_SKILLS, k).toLowerCase()).join(", ")}. </>}{m.toImprove && <>🎯 À améliorer : {matchLabel(MATCH_SKILLS, m.toImprove).toLowerCase()}.</>}</span>}
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-52 flex-1" aria-label={`Ta réponse pour ce match`} maxLength={300} placeholder="Ta réponse (visible de lui)" value={drafts[m.id] ?? m.coachComment} onChange={(e) => setDrafts({ ...drafts, [m.id]: e.target.value })} />
              <button className="btn-clay btn-sm" disabled={(drafts[m.id] ?? m.coachComment) === m.coachComment} onClick={async () => { await put(`/players/${p.id}/declared-matches/${m.id}/comment`, { comment: drafts[m.id] ?? "" }); setDrafts((d) => { const n = { ...d }; delete n[m.id]; return n; }); reload(); }}>Répondre</button>
              <button className="btn-danger btn-sm" onClick={async () => { if (confirm("Supprimer ce match déclaré par le joueur ?")) { await del(`/players/${p.id}/declared-matches/${m.id}`); reload(); } }}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
