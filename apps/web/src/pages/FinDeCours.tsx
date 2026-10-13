import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, put } from "../api";
import { StarLine, StarLinesEditor, starItems, starLinesError, activeLines } from "../components/Stars";
import { Avatar, Empty, Err, Page, PageHead } from "../components/ui";
import { CourseStar, currentSeason, fullName, Goal, goalApplies, Player, todayIso, trimesterOf } from "../types";

type Row = { lines: StarLine[]; had: boolean; dirty?: boolean };
const EMPTY: Row = { lines: [], had: false };

// Fin de cours : pour chaque joueur, des étoiles SUR SES MISSIONS (avec une raison et un petit mot) + les 2 qualités du cours (attitude, concentration sur ses objectifs).
export default function FinDeCours() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [day, setDay] = useState(todayIso());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  const [allStars, setAllStars] = useState<Record<string, CourseStar[]>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { get<Player[]>("/players").then(setPlayers).catch(() => setPlayers([])); }, []);
  // On recharge ce qui a déjà été donné ce jour-là (pour pouvoir corriger) et les missions du trimestre de ce cours
  useEffect(() => {
    if (!players) return;
    const d = new Date(day + "T12:00:00"), season = currentSeason(d), tri = trimesterOf(d);
    Promise.all(players.map(async (p) => {
      const [stars, gs] = await Promise.all([
        get<CourseStar[]>(`/players/${p.id}/stars`).catch(() => [] as CourseStar[]),
        get<Goal[]>(`/players/${p.id}/goals?season=${season}`).catch(() => [] as Goal[]),
      ]);
      const list = stars.filter((s) => s.day === day);
      return [p.id, stars, { lines: list.map((s) => ({ stars: s.stars, reason: s.reason, domain: s.domain ?? "", comment: s.comment, goalId: s.goalId ?? undefined })), had: list.length > 0 } as Row, gs.filter((g) => goalApplies(g, tri))] as const;
    })).then((all) => {
      setRows(Object.fromEntries(all.map(([id, , r]) => [id, r])));
      setAllStars(Object.fromEntries(all.map(([id, st]) => [id, st])));
      setGoals(Object.fromEntries(all.map(([id, , , gs]) => [id, gs])));
      setMsg(null);
    });
  }, [players, day]);
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? EMPTY), ...patch, dirty: true } }));
  
  // Enregistre un joueur (ou tous ceux qui ont été modifiés) : les lignes affichées remplacent celles du cours
  async function saveRows(list: Player[]): Promise<boolean> {
    setBusy(true); setMsg(null);
    try {
      for (const p of list) {
        const r = rows[p.id]; if (!r) continue;
        const bad = starLinesError(r.lines); if (bad) throw new Error(`${p.firstName} : ${bad}`);
        const act = activeLines(r.lines);
        if (act.length) await put(`/players/${p.id}/stars/${day}`, { items: starItems(r.lines) });
        else if (r.had) await del(`/players/${p.id}/stars/${day}`);
      }
      const ids = new Set(list.map((p) => p.id));
      setRows((all) => Object.fromEntries(Object.entries(all).map(([id, r]) => [id, ids.has(id) ? { ...r, lines: activeLines(r.lines), had: activeLines(r.lines).length > 0, dirty: false } : r])));
      setMsg({ ok: true, text: list.length === 1 ? `✅ Étoiles de ${list[0].firstName} enregistrées.` : `✅ Modifications enregistrées pour ${list.length} joueur${list.length > 1 ? "s" : ""}.` });
      return true;
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); return false; } finally { setBusy(false); }
  }
  const dirtyPlayers = (players ?? []).filter((p) => rows[p.id]?.dirty);
  const save = () => saveRows(dirtyPlayers);

  return (
    <>
      <PageHead eyebrow="Centre de compétition jeunes" title="⭐ Fin de cours">Touche un joueur : tu vois <strong>ses objectifs</strong>. Un bouton par objectif travaillé : ⬇️ retire une étoile (avec une explication que le joueur verra), 😕 ne change rien, 🙂 donne 1 étoile, 😃 en donne 2. Toujours pour l'effort, l'attitude ou un progrès, jamais pour le seul résultat.</PageHead>
      <Page>
        <div className="flex flex-wrap items-center gap-3">
          <div className="field"><label htmlFor="fc-day">Date du cours</label><input id="fc-day" type="date" className="input !w-auto" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} /></div>
          <Link to="/coach/centre" className="font-bold text-ink underline">← Tous mes joueurs</Link>
        </div>
        {players === null && <div className="skeleton h-32" role="status" aria-label="Chargement en cours" />}
        {players && !players.length && <Empty>Aucun joueur pour l'instant.</Empty>}
        {players && players.length > 0 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Joueurs du cours">
            {players.map((p) => { const r = rows[p.id] ?? EMPTY; const on = (sel ?? players[0].id) === p.id; return (
              <button key={p.id} type="button" role="tab" aria-selected={on} onClick={() => setSel(p.id)}
                className={"min-h-11 rounded-full border-2 px-4 font-bold " + (on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-sand")}>
                {p.firstName}{r.dirty ? " ✏️" : r.had ? " ✔" : ""}
              </button>
            ); })}
          </div>
        )}
        {(players ?? []).filter((p) => p.id === (sel ?? players?.[0]?.id)).map((p) => { const r = rows[p.id] ?? EMPTY; const idx = (players ?? []).findIndex((x) => x.id === p.id), next = (players ?? [])[idx + 1]; return (
          <section key={p.id} className="card grid gap-3" aria-label={`Fin de cours de ${p.firstName}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-3"><Avatar name={fullName(p)} size={44} /><strong className="text-lg">{p.firstName} {p.lastName}</strong>{r.had && !r.dirty && <span className="badge">déjà enregistré</span>}{r.dirty && <span className="badge !border-[#e0b100] !bg-[#fff3b0]">⚠️ pas encore enregistré</span>}</span>
              <strong aria-live="polite">{(() => { const gain = r.lines.filter((l) => l.stars > 0).reduce((n, l) => n + l.stars, 0), lost = r.lines.filter((l) => l.stars < 0).reduce((n, l) => n - l.stars, 0); return <>⭐ +{gain}{lost > 0 && <span className="text-[#b3261e]"> · 📉 −{lost}</span>} ce cours</>; })()}</strong>
            </div>
            <StarLinesEditor who={p.firstName} lines={r.lines} goals={goals[p.id] ?? []} allStars={allStars[p.id]} day={day} onChange={(lines) => set(p.id, { lines })} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-clay" disabled={busy || !r.dirty} onClick={async () => { if (await saveRows([p]) && next) setSel(next.id); }}>{next ? `💾 Enregistrer ${p.firstName} et passer à ${next.firstName} →` : `💾 Enregistrer ${p.firstName}`}</button>
            </div>
          </section>
        ); })}
        {players && players.length > 0 && (
          <div className="sticky bottom-[72px] z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-3">
            <button className="btn-clay" onClick={save} disabled={busy || dirtyPlayers.length === 0}>{busy ? "Enregistrement…" : dirtyPlayers.length ? `Enregistrer les modifications (${dirtyPlayers.length})` : "Tout est enregistré ✓"}</button>
            {msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}
          </div>
        )}
        <Err msg={msg && !msg.ok ? msg.text : ""} />
      </Page>
    </>
  );
}
