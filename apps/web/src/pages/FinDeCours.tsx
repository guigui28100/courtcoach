import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, put } from "../api";
import { StarLine, StarLinesEditor, starLinesError } from "../components/Stars";
import { Avatar, Empty, Err, Page, PageHead } from "../components/ui";
import { CourseStar, fullName, Player, todayIso } from "../types";

type Row = { lines: StarLine[]; comment: string; had: boolean; dirty?: boolean };

// Fin de cours : le coach donne les étoiles à tous ses joueurs d'un coup (1 à 3, une raison, un petit mot facultatif).
export default function FinDeCours() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [day, setDay] = useState(todayIso());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { get<Player[]>("/players").then(setPlayers).catch(() => setPlayers([])); }, []);
  // On recharge ce qui a déjà été donné ce jour-là (pour pouvoir corriger)
  useEffect(() => {
    if (!players) return;
    Promise.all(players.map(async (p) => [p.id, (await get<CourseStar[]>(`/players/${p.id}/stars`).catch(() => [])).filter((s) => s.day === day)] as const)).then((all) => {
      setRows(Object.fromEntries(all.map(([id, list]) => [id, { lines: list.map((s) => ({ stars: s.stars, reason: s.reason, domain: s.domain ?? "" })), comment: list.find((s) => s.comment)?.comment ?? "", had: list.length > 0 }])));
      setMsg(null);
    });
  }, [players, day]);
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { lines: [], comment: "", had: false }), ...patch, dirty: true } }));
  
  // Enregistre un joueur (ou tous ceux qui ont été modifiés) : les lignes affichées remplacent celles du cours
  async function saveRows(list: Player[]) {
    setBusy(true); setMsg(null);
    try {
      for (const p of list) {
        const r = rows[p.id]; if (!r) continue;
        const bad = starLinesError(r.lines); if (bad) throw new Error(`${p.firstName} : ${bad}`);
        if (r.lines.length) await put(`/players/${p.id}/stars/${day}`, { items: r.lines.map((l, i) => ({ ...l, comment: i === 0 ? r.comment.trim() || undefined : undefined })) });
        else if (r.had) await del(`/players/${p.id}/stars/${day}`);
      }
      const ids = new Set(list.map((p) => p.id));
      setRows((all) => Object.fromEntries(Object.entries(all).map(([id, r]) => [id, ids.has(id) ? { ...r, had: r.lines.length > 0, dirty: false } : r])));
      setMsg({ ok: true, text: list.length === 1 ? `✅ Étoiles de ${list[0].firstName} enregistrées.` : `✅ Modifications enregistrées pour ${list.length} joueur${list.length > 1 ? "s" : ""}.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }
  const dirtyPlayers = (players ?? []).filter((p) => rows[p.id]?.dirty);
  const save = () => saveRows(dirtyPlayers);

  return (
    <>
      <PageHead eyebrow="Centre de compétition jeunes" title="⭐ Fin de cours">Donne des étoiles à tes joueurs : 1 = bien, 2 = très bien, 3 = exceptionnel. Pour chaque joueur, tu peux ajouter plusieurs lignes (par exemple 2 étoiles pour l'effort en Mental, puis 1 étoile pour un progrès en Technique). Toujours pour l'effort, l'attitude ou un progrès, jamais pour le seul résultat.</PageHead>
      <Page>
        <div className="flex flex-wrap items-center gap-3">
          <div className="field"><label htmlFor="fc-day">Date du cours</label><input id="fc-day" type="date" className="input !w-auto" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} /></div>
          <Link to="/coach/centre" className="font-bold text-ink underline">← Tous mes joueurs</Link>
        </div>
        {players === null && <div className="skeleton h-32" role="status" aria-label="Chargement en cours" />}
        {players && !players.length && <Empty>Aucun joueur pour l'instant.</Empty>}
        <ul className="m-0 grid list-none gap-3 p-0">
          {(players ?? []).map((p) => { const r = rows[p.id] ?? { lines: [], comment: "", had: false }; return (
            <li key={p.id} className={"card grid gap-3 " + (r.lines.length > 0 ? "!border-[#e0b100] !bg-[#fffdf0]" : "")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3"><Avatar name={fullName(p)} size={44} /><strong className="text-lg">{p.firstName} {p.lastName}</strong>{r.had && !r.dirty && <span className="badge">déjà enregistré</span>}{r.dirty && <span className="badge !border-[#e0b100] !bg-[#fff3b0]">⚠️ pas encore enregistré</span>}</span>
                <span className="flex items-center gap-3"><strong aria-live="polite">⭐ {r.lines.reduce((n, l) => n + l.stars, 0)} étoile{r.lines.reduce((n, l) => n + l.stars, 0) > 1 ? "s" : ""} ce cours</strong>{r.dirty && <button className="btn-clay btn-sm" disabled={busy} onClick={() => saveRows([p])}>Enregistrer {p.firstName}</button>}</span>
              </div>
              <StarLinesEditor who={p.firstName} lines={r.lines} onChange={(lines) => set(p.id, { lines })} />
              {r.lines.length > 0 && (
                <>
                  <label className="sr-only" htmlFor={`fc-c-${p.id}`}>Petit mot pour {p.firstName}</label>
                  <input id={`fc-c-${p.id}`} className="input" maxLength={140} placeholder="Un petit mot (facultatif) : « Super service aujourd'hui ! »" value={r.comment} onChange={(e) => set(p.id, { comment: e.target.value })} />
                </>
              )}
            </li>
          ); })}
        </ul>
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
