import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, put } from "../api";
import { StarLine, StarLinesEditor, starItems, starLinesError, activeLines } from "../components/Stars";
import { offDayReason } from "../schoolDays";
import { parseDictation } from "../dictation";
import { Avatar, BackLink, Empty, Err, Page, PageHead } from "../components/ui";
import { CourseStar, QUALITIES, currentSeason, fullName, Goal, goalApplies, Player, todayIso, trimesterOf } from "../types";

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
  const [dict, setDict] = useState("");
  const [awake, setAwake] = useState(false);
  // Écran toujours allumé pendant le cours (si le téléphone le permet) ; il se remet en route quand on revient sur la page
  useEffect(() => {
    if (!awake) return;
    let lock: { release: () => Promise<void> } | null = null, stop = false;
    const ask = async () => { try { lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen"); if (stop) lock?.release(); } catch { /* refusé : tant pis */ } };
    const back = () => { if (document.visibilityState === "visible") ask(); };
    ask(); document.addEventListener("visibilitychange", back);
    return () => { stop = true; document.removeEventListener("visibilitychange", back); lock?.release().catch(() => {}); };
  }, [awake]);
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
        if (act.length) {
          const off = offDayReason(day, p.courseDays);
          if (off && !confirm(`${p.firstName} : ${off}\n\nEnregistrer quand même ?`)) continue;
          await put(`/players/${p.id}/stars/${day}`, { items: starItems(r.lines), confirmOffDay: !!off });
        }
        else if (r.had) await del(`/players/${p.id}/stars/${day}`);
      }
      const ids = new Set(list.map((p) => p.id));
      setRows((all) => Object.fromEntries(Object.entries(all).map(([id, r]) => [id, ids.has(id) ? { ...r, lines: activeLines(r.lines), had: activeLines(r.lines).length > 0, dirty: false } : r])));
      setMsg({ ok: true, text: list.length === 1 ? `✅ Étoiles de ${list[0].firstName} enregistrées.` : `✅ Modifications enregistrées pour ${list.length} joueur${list.length > 1 ? "s" : ""}.` });
      return true;
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); return false; } finally { setBusy(false); }
  }
  const dictResults = (players ?? []).length && dict.trim() ? parseDictation(dict, (players ?? []).map((p) => ({ id: p.id, firstName: p.firstName })), (id) => goals[id] ?? []) : [];
  const dictOk = dictResults.filter((x) => x.ok);
  // Remplit les fiches avec ce que la dictée a compris (rien n'est enregistré avant « Enregistrer »)
  function applyDict() {
    setRows((all) => {
      const next = { ...all };
      for (const x of dictOk) {
        const cur = next[x.playerId!] ?? EMPTY, l = x.line!, lines = [...cur.lines];
        if (l.goalId) {
          const g = (goals[x.playerId!] ?? []).find((y) => y.id === l.goalId)!;
          const entry: StarLine = { stars: l.stars, reason: "", domain: g.axis.toLowerCase(), comment: l.comment, goalId: g.id };
          const i = lines.findIndex((y) => y.goalId === g.id);
          if (i >= 0) lines[i] = { ...lines[i], ...entry }; else lines.push(entry);
        } else {
          const q = QUALITIES.find((y) => y.key === l.quality)!;
          const entry: StarLine = { stars: l.stars, reason: l.stars < 0 ? "neg-" + q.reason : q.reason, domain: q.domain, comment: l.comment };
          const i = lines.findIndex((y) => !y.goalId && (y.reason === q.reason || y.reason === "neg-" + q.reason));
          if (i >= 0) lines[i] = entry; else lines.push(entry);
        }
        next[x.playerId!] = { ...cur, lines, dirty: true };
      }
      return next;
    });
    const first = dictOk[0]?.playerId; if (first) setSel(first);
    setDict("");
    setMsg({ ok: true, text: `✍️ ${dictOk.length} ligne${dictOk.length > 1 ? "s" : ""} remplie${dictOk.length > 1 ? "s" : ""} : vérifie puis enregistre.` });
  }
  const dirtyPlayers = (players ?? []).filter((p) => rows[p.id]?.dirty);
  const save = () => saveRows(dirtyPlayers);

  return (
    <>
      <PageHead eyebrow="Centre de compétition jeunes" title="⭐ Fin de cours">Touche un joueur : tu vois <strong>ses objectifs</strong>. Un bouton par objectif travaillé : ⬇️ retire une étoile (avec une explication que le joueur verra), 😕 ne change rien, 🙂 donne 1 étoile, 😃 en donne 2. Toujours pour l'effort, l'attitude ou un progrès, jamais pour le seul résultat.</PageHead>
      <Page>
        <div className="flex flex-wrap items-center gap-3">
          <div className="field"><label htmlFor="fc-day">Date du cours</label><input id="fc-day" type="date" className="input !w-auto" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} /></div>
          <BackLink fallback="/coach/centre" className="font-bold text-ink underline">← Retour</BackLink>
        </div>
        {players === null && <div className="skeleton h-32" role="status" aria-label="Chargement en cours" />}
        {players && !players.length && <Empty>Aucun joueur pour l'instant.</Empty>}
        {players && players.length > 0 && (
          <details className="card grid gap-2" open={dict.length > 0}>
            <summary className="cursor-pointer font-bold">✍️ Dictée rapide : une phrase par joueur</summary>
            <p className="hint m-0">Écris, ou dicte avec le micro de ton clavier. Exemple : <em>« Léo revers plus deux, il a ouvert la raquette. Nina attitude +1. »</em> Le site remplit les fiches ; rien n'est enregistré tant que tu ne l'as pas décidé. Si une étoile est en moins, dis aussi pourquoi.</p>
            <label className="sr-only" htmlFor="fc-dict">Dictée du cours</label>
            <textarea id="fc-dict" className="input min-h-24" value={dict} onChange={(e) => setDict(e.target.value)} placeholder="Léo revers +2 bien placé. Nina service moins un, elle regarde ailleurs." />
            {dictResults.length > 0 && (
              <ul className="m-0 grid list-none gap-2 p-0" aria-live="polite">
                {dictResults.map((x, i) => (
                  <li key={i} className={"grid gap-0.5 rounded-xl border-2 p-3 " + (x.ok ? "border-line bg-white" : "border-[#e0b100] bg-[#fff3b0]")}>
                    {x.ok ? <span className="font-bold">{x.playerName} · {x.label} · <span className={x.line!.stars < 0 ? "text-bad" : "text-ok"}>{x.line!.stars > 0 ? "+" : "−"}{Math.abs(x.line!.stars)} ⭐</span></span>
                      : <span className="font-bold">⚠️ « {x.raw} »</span>}
                    {x.ok && x.line!.comment && <small className="text-muted">💬 {x.line!.comment}</small>}
                    {!x.ok && <small className="font-bold text-ink">{x.warn}</small>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-clay" disabled={!dictOk.length} onClick={applyDict}>{dictOk.length ? `Remplir ${dictOk.length} ligne${dictOk.length > 1 ? "s" : ""}${dictResults.length > dictOk.length ? " (les phrases en jaune sont laissées)" : ""}` : "Rien à remplir pour l'instant"}</button>
              {"wakeLock" in navigator && <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={awake} onChange={(e) => setAwake(e.target.checked)} /> Garder l'écran allumé pendant le cours</label>}
            </div>
          </details>
        )}
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
            {offDayReason(day, p.courseDays) && <p role="status" className="m-0 rounded-xl border-2 border-[#e0b100] bg-[#fff3b0] p-3 font-bold text-ink">⚠️ {offDayReason(day, p.courseDays)} Une confirmation te sera demandée.</p>}
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
