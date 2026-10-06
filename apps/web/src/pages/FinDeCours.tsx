import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, put } from "../api";
import { DomainPicker, ReasonPicker, StarPicker } from "../components/Stars";
import { Avatar, Empty, Err, Page, PageHead } from "../components/ui";
import { CourseStar, fullName, Player, todayIso } from "../types";

type Row = { stars: number; reason: string; domain: string; comment: string; had: boolean };

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
    Promise.all(players.map(async (p) => [p.id, (await get<CourseStar[]>(`/players/${p.id}/stars`).catch(() => [])).find((s) => s.day === day)] as const)).then((all) => {
      setRows(Object.fromEntries(all.map(([id, s]) => [id, { stars: s?.stars ?? 0, reason: s?.reason ?? "effort", domain: s?.domain ?? "", comment: s?.comment ?? "", had: !!s }])));
      setMsg(null);
    });
  }, [players, day]);
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { stars: 0, reason: "effort", domain: "", comment: "", had: false }), ...patch } }));
  const given = Object.values(rows).filter((r) => r.stars > 0).length;

  async function save() {
    setBusy(true); setMsg(null);
    try {
      for (const p of players ?? []) {
        const r = rows[p.id]; if (!r) continue;
        if (r.stars > 0 && !r.domain) throw new Error(`Choisis le domaine du radar pour ${p.firstName}.`);
        if (r.stars > 0) await put(`/players/${p.id}/stars/${day}`, { stars: r.stars, reason: r.reason, domain: r.domain, comment: r.comment.trim() || undefined });
        else if (r.had) await del(`/players/${p.id}/stars/${day}`);
      }
      setRows((all) => Object.fromEntries(Object.entries(all).map(([id, r]) => [id, { ...r, had: r.stars > 0 }])));
      setMsg({ ok: true, text: `✅ Étoiles enregistrées pour ${given} joueur${given > 1 ? "s" : ""}.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead eyebrow="Centre de compétition jeunes" title="⭐ Fin de cours">Donne des étoiles à tes joueurs : 1 = bien, 2 = très bien, 3 = exceptionnel. Toujours pour l'effort, l'attitude ou un progrès, jamais pour le seul résultat. Choisis aussi le domaine du radar que l'étoile fait grandir.</PageHead>
      <Page>
        <div className="flex flex-wrap items-center gap-3">
          <div className="field"><label htmlFor="fc-day">Date du cours</label><input id="fc-day" type="date" className="input !w-auto" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} /></div>
          <Link to="/coach/centre" className="font-bold text-ink underline">← Tous mes joueurs</Link>
        </div>
        {players === null && <div className="skeleton h-32" role="status" aria-label="Chargement en cours" />}
        {players && !players.length && <Empty>Aucun joueur pour l'instant.</Empty>}
        <ul className="m-0 grid list-none gap-3 p-0">
          {(players ?? []).map((p) => { const r = rows[p.id] ?? { stars: 0, reason: "effort", domain: "", comment: "", had: false }; return (
            <li key={p.id} className={"card grid gap-3 " + (r.stars > 0 ? "!border-[#e0b100] !bg-[#fffdf0]" : "")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3"><Avatar name={fullName(p)} size={44} /><strong className="text-lg">{p.firstName} {p.lastName}</strong>{r.had && <span className="badge">déjà enregistré</span>}</span>
                <StarPicker value={r.stars} onChange={(n) => set(p.id, { stars: n })} label={`Étoiles pour ${p.firstName}`} />
              </div>
              {r.stars > 0 && (
                <div className="grid gap-2">
                  <ReasonPicker value={r.reason} onChange={(id) => set(p.id, { reason: id })} />
                  <p className="hint m-0">Quel domaine du radar cette étoile fait-elle grandir ?</p>
                  <DomainPicker value={r.domain} onChange={(id) => set(p.id, { domain: id })} />
                  <label className="sr-only" htmlFor={`fc-c-${p.id}`}>Petit mot pour {p.firstName}</label>
                  <input id={`fc-c-${p.id}`} className="input" maxLength={140} placeholder="Un petit mot (facultatif) : « Super service aujourd'hui ! »" value={r.comment} onChange={(e) => set(p.id, { comment: e.target.value })} />
                </div>
              )}
            </li>
          ); })}
        </ul>
        {players && players.length > 0 && (
          <div className="sticky bottom-[72px] z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-3">
            <button className="btn-clay" onClick={save} disabled={busy}>{busy ? "Enregistrement…" : `Enregistrer les étoiles (${given})`}</button>
            {msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}
          </div>
        )}
        <Err msg={msg && !msg.ok ? msg.text : ""} />
      </Page>
    </>
  );
}
