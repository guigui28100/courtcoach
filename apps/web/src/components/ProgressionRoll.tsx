import { useMemo, useState } from "react";
import { Attend, Group, presentRate } from "../progression";

export const todayParis = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
const fr = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const CHOICES: [Attend, string, string][] = [["p", "Présent", "#3f7a56"], ["r", "En retard", "#2a6f97"], ["a", "Absent", "#b5483a"], ["e", "Excusé", "#935500"]];
const here = (v?: string) => v === "p" || v === "r";

// L'appel d'une séance : prénoms, quatre statuts, « Tous présents ». Enregistré à chaque touche, modifiable ensuite.
export function Roll({ g, upd, date, onDate }: { g: Group; upd: (p: Partial<Group>) => void; date: string; onDate?: (d: string) => void }) {
  const names = g.players || []; const appel = g.appel || {}; const day = appel[date] || {};
  const count = (d: string) => Object.values(appel[d] || {}).filter(here).length;
  const mark = (n: string, v: Attend) => { const cur = { ...(appel[date] || {}) }; if (cur[n] === v) delete cur[n]; else cur[n] = v; const next = { ...appel, [date]: cur }; if (!Object.keys(cur).length) delete next[date]; upd({ appel: next }); };
  const all = () => upd({ appel: { ...appel, [date]: Object.fromEntries(names.map((n) => [n, "p" as Attend])) } });
  if (!names.length) return <p className="m-0 text-muted">Ajoute d'abord les prénoms des joueurs (onglet « Groupe et appel »).</p>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <b>{fr(date)} : {count(date)} présent{count(date) > 1 ? "s" : ""} sur {names.length}</b>
        <div className="flex flex-wrap items-end gap-2">
          {onDate && <label className="grid gap-1"><span className="text-xs font-bold text-muted">Date de la séance</span><input id="pl-date" className="input" type="date" value={date} max="2100-01-01" onChange={(e) => onDate(e.target.value || todayParis())} /></label>}
          <button type="button" className="btn-outline btn-sm" onClick={all}>Tous présents</button>
        </div>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0">{names.map((n) => (
        <li key={n} className="grid items-center gap-2 border-t border-line pt-2 sm:grid-cols-[minmax(7rem,1fr)_3fr]">
          <b>{n}</b>
          <div role="group" aria-label={n} className="grid grid-cols-2 gap-1 sm:grid-cols-4">{CHOICES.map(([k, label, color]) => (
            <button key={k} type="button" aria-pressed={day[n] === k} onClick={() => mark(n, k)} className="min-h-10 rounded-md border border-line px-2 text-sm font-bold" style={day[n] === k ? { background: color, color: "#fff", borderColor: color } : undefined}>{label}</button>))}</div>
        </li>))}</ul>
      <p className="hint m-0">L'appel s'enregistre à chaque touche et reste modifiable. Un joueur en retard compte comme présent ; un joueur excusé n'entre pas dans le taux de présence.</p>
    </div>
  );
}

// Joueurs d'un groupe (prénoms seulement), appel, historique et taux de présence ; un joueur peut passer d'un groupe à un autre.
export function Players({ g, upd, others, onTransfer }: { g: Group; upd: (p: Partial<Group>) => void; others?: { id: string; name: string }[]; onTransfer?: (name: string, toId: string) => void }) {
  const names = g.players || []; const appel = g.appel || {};
  const [text, setText] = useState(""); const [date, setDate] = useState(todayParis()); const [moving, setMoving] = useState("");
  const dates = useMemo(() => Object.keys(appel).sort().reverse(), [appel]);
  const setNames = (n: string[]) => upd({ players: n, size: n.length });
  const add = () => {
    const add = text.split(/[,;\n]/).map((t) => t.trim().slice(0, 30)).filter(Boolean);
    const set = new Set(names.map((n) => n.toLowerCase())); const fresh = add.filter((n) => !set.has(n.toLowerCase()) && set.add(n.toLowerCase()));
    if (fresh.length) setNames([...names, ...fresh].slice(0, 40)); setText("");
  };
  const count = (d: string) => Object.values(appel[d] || {}).filter(here).length;
  const coll = presentRate(g);
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border border-line bg-white p-4">
        <h2 className="m-0 text-lg">Les joueurs du groupe</h2>
        <p className="hint m-0">Écris seulement les <b>prénoms</b> (pas de nom de famille), séparés par une virgule. Ils ne servent qu'à l'appel et restent visibles de toi seul. Touche un prénom pour le retirer ou le passer dans un autre groupe.</p>
        {names.length > 0 && <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{names.map((n) => (
          <li key={n}><button type="button" className={`btn-sm ${moving === n ? "btn-ink" : "btn-outline"}`} aria-expanded={moving === n} onClick={() => setMoving(moving === n ? "" : n)}>{n}</button></li>))}</ul>}
        {moving && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-paper p-3 text-sm">
            <b>{moving}</b>
            <button type="button" className="btn-outline btn-sm" onClick={() => { setNames(names.filter((x) => x !== moving)); setMoving(""); }}>Retirer du groupe</button>
            {others && others.length > 0 && onTransfer && <label className="flex items-center gap-2"><span>ou passer dans :</span>
              <select id="pl-move" className="input" value="" onChange={(e) => { if (e.target.value) { onTransfer(moving, e.target.value); setMoving(""); } }}><option value="">Choisir un groupe…</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
          </div>)}
        <div className="flex flex-wrap gap-2">
          <input id="pl-add" className="input min-w-0 flex-1" value={text} maxLength={200} placeholder="Ex. Léa, Tom, Inès" aria-label="Ajouter des prénoms" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="btn-ink" onClick={add}>Ajouter</button>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-line bg-white p-4">
        <h2 className="m-0 text-lg">Faire l'appel</h2>
        <Roll g={g} upd={upd} date={date} onDate={setDate} />
      </section>

      {dates.length > 0 && (
        <details className="rounded-xl border border-line bg-white p-4">
          <summary className="cursor-pointer font-bold">Historique des présences ({dates.length} appel{dates.length > 1 ? "s" : ""}){coll !== null ? ` · groupe : ${coll} %` : ""}</summary>
          <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-sm">{dates.map((d) => <li key={d}><button type="button" className="underline" onClick={() => setDate(d)}>{fr(d)}</button> : {count(d)} présent{count(d) > 1 ? "s" : ""} sur {names.length}</li>)}</ul>
          <h3 className="mb-1 mt-3 text-sm">Présence par joueur ({g.season || "saison en cours"})</h3>
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">{names.map((n) => { const r = presentRate(g, n); return <li key={n}>{n} : {r === null ? "pas encore d'appel" : `${r} % de présence`}</li>; })}</ul>
        </details>)}
    </div>
  );
}
