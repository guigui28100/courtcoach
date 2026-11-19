import { useMemo, useState } from "react";
import { Attend, Group } from "../progression";

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
const fr = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const CHOICES: [Attend, string, string][] = [["p", "Présent", "#3f7a56"], ["a", "Absent", "#b5483a"], ["e", "Excusé", "#935500"]];

// Joueurs d'un groupe (prénoms seulement) et appel séance par séance.
export function Players({ g, upd }: { g: Group; upd: (p: Partial<Group>) => void }) {
  const names = g.players || [];
  const appel = g.appel || {};
  const [text, setText] = useState(""); const [date, setDate] = useState(today());
  const day = appel[date] || {};
  const dates = useMemo(() => Object.keys(appel).sort().reverse(), [appel]);
  const setNames = (n: string[]) => upd({ players: n, size: n.length });
  const add = () => {
    const add = text.split(/[,;\n]/).map((t) => t.trim().slice(0, 30)).filter(Boolean);
    const set = new Set(names.map((n) => n.toLowerCase())); const fresh = add.filter((n) => !set.has(n.toLowerCase()) && set.add(n.toLowerCase()));
    if (fresh.length) setNames([...names, ...fresh].slice(0, 40)); setText("");
  };
  const mark = (n: string, v: Attend) => { const cur = { ...(appel[date] || {}) }; if (cur[n] === v) delete cur[n]; else cur[n] = v; const next = { ...appel, [date]: cur }; if (!Object.keys(cur).length) delete next[date]; upd({ appel: next }); };
  const all = () => upd({ appel: { ...appel, [date]: Object.fromEntries(names.map((n) => [n, "p" as Attend])) } });
  const count = (d: string) => Object.values(appel[d] || {}).filter((v) => v === "p").length;
  const rate = (n: string) => { const t = dates.filter((d) => appel[d][n]); return t.length ? Math.round((t.filter((d) => appel[d][n] === "p").length / t.length) * 100) : null; };

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border border-line bg-white p-4">
        <h2 className="m-0 text-lg">Les joueurs du groupe</h2>
        <p className="hint m-0">Écris seulement les <b>prénoms</b> (pas de nom de famille), séparés par une virgule. Ils ne servent qu'à l'appel et restent visibles de toi seul.</p>
        {names.length > 0 && <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{names.map((n) => (
          <li key={n}><button type="button" className="btn-outline btn-sm" aria-label={`Retirer ${n}`} onClick={() => setNames(names.filter((x) => x !== n))}>{n} ✕</button></li>))}</ul>}
        <div className="flex flex-wrap gap-2">
          <input id="pl-add" className="input min-w-0 flex-1" value={text} maxLength={200} placeholder="Ex. Léa, Tom, Inès" aria-label="Ajouter des prénoms" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="btn-ink" onClick={add}>Ajouter</button>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="m-0 text-lg">Faire l'appel</h2>
          <label className="grid gap-1"><span className="text-xs font-bold text-muted">Date de la séance</span><input id="pl-date" className="input" type="date" value={date} max="2100-01-01" onChange={(e) => setDate(e.target.value || today())} /></label>
        </div>
        {!names.length ? <p className="m-0 text-muted">Ajoute d'abord les prénoms des joueurs.</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{fr(date)} : {count(date)} présent{count(date) > 1 ? "s" : ""} sur {names.length}</b><button type="button" className="btn-outline btn-sm" onClick={all}>Tous présents</button></div>
            <ul className="m-0 grid list-none gap-2 p-0">{names.map((n) => (
              <li key={n} className="grid items-center gap-2 border-t border-line pt-2 sm:grid-cols-[minmax(7rem,1fr)_2fr]">
                <b>{n}</b>
                <div role="group" aria-label={n} className="grid grid-cols-3 gap-1">{CHOICES.map(([k, label, color]) => (
                  <button key={k} type="button" aria-pressed={day[n] === k} onClick={() => mark(n, k)} className="min-h-10 rounded-md border border-line px-2 text-sm font-bold" style={day[n] === k ? { background: color, color: "#fff", borderColor: color } : undefined}>{label}</button>))}</div>
              </li>))}</ul>
            <p className="hint m-0">L'appel s'enregistre à chaque touche.</p>
          </>)}
      </section>

      {dates.length > 0 && (
        <details className="rounded-xl border border-line bg-white p-4">
          <summary className="cursor-pointer font-bold">Les appels passés ({dates.length})</summary>
          <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-sm">{dates.map((d) => <li key={d}><button type="button" className="underline" onClick={() => setDate(d)}>{fr(d)}</button> : {count(d)} présent{count(d) > 1 ? "s" : ""} sur {names.length}</li>)}</ul>
          <h3 className="mb-1 mt-3 text-sm">Présence par joueur</h3>
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">{names.map((n) => { const r = rate(n); return <li key={n}>{n} : {r === null ? "pas encore d'appel" : `${r} % de présence`}</li>; })}</ul>
        </details>)}
    </div>
  );
}
