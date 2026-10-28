import { useEffect, useState } from "react";
import { get, put } from "../api";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const HOURS = Array.from({ length: 13 }, (_, i) => 9 + i); // créneaux d'une heure, de 9 h à 22 h
const pad = (h: number) => String(h).padStart(2, "0") + ":00";
const key = (wd: number, h: number) => `${wd}-${h}`;
type Kind = "ADULTES" | "COMPETITION" | "ECOLE";
interface Course { weekday: number; start: string; end: string; label: string; kind?: string }
// Les 3 choses à placer : on en choisit une, puis on touche les cases
const BRUSHES: { k: Kind; label: string; short: string; bg: string }[] = [
  { k: "ADULTES", label: "Cours adultes", short: "Adultes", bg: "#2f5f9e" },
  { k: "COMPETITION", label: "Compétition jeunes", short: "Compét.", bg: "#6f4b9e" },
  { k: "ECOLE", label: "École de tennis", short: "École", bg: "#c2561f" },
];
const brushOf = (k: Kind) => BRUSHES.find((b) => b.k === k)!;

// Le coach place, jour par jour et heure par heure, les cours de la semaine d'un entraîneur (cours adultes, compétition jeunes, école de tennis)
export function WeekPlanner({ id, name }: { id: string; name: string }) {
  const [on, setOn] = useState<Map<string, Kind>>(new Map());
  const [kept, setKept] = useState<Course[]>([]); // lignes écrites autrement (sans type) : on ne les touche pas
  const [brush, setBrush] = useState<Kind | null>("ADULTES"); // null = gomme
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    get<Course[]>(`/club/schedule/${id}`).then((list) => {
      const m = new Map<string, Kind>();
      for (const c of list) if (c.kind) for (let h = +c.start.slice(0, 2); h < +c.end.slice(0, 2); h++) if (HOURS.includes(h)) m.set(key(c.weekday, h), c.kind as Kind);
      setOn(m); setKept(list.filter((c) => !c.kind)); setReady(true);
    }).catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, [id]);

  const set = (n: Map<string, Kind>, k: string, all: boolean) => { if (brush === null || all) n.delete(k); else n.set(k, brush); };
  const toggle = (k: string) => setOn((o) => { const n = new Map(o); set(n, k, o.get(k) === brush); return n; });
  const toggleDay = (wd: number) => setOn((o) => { const n = new Map(o); const all = HOURS.every((h) => n.get(key(wd, h)) === brush); for (const h of HOURS) set(n, key(wd, h), all); return n; });
  const toggleHour = (h: number) => setOn((o) => { const n = new Map(o); const all = DAYS.every((_, wd) => n.get(key(wd, h)) === brush); DAYS.forEach((_, wd) => set(n, key(wd, h), all)); return n; });

  async function save() {
    setMsg(null);
    // Les heures qui se suivent avec le même type sont regroupées en un seul cours
    const items: Course[] = [];
    for (const b of BRUSHES) DAYS.forEach((_, wd) => { let from: number | null = null; for (let h = 9; h <= 22; h++) { const yes = h < 22 && on.get(key(wd, h)) === b.k; if (yes && from === null) from = h; if (!yes && from !== null) { items.push({ weekday: wd, start: pad(from), end: pad(h), label: b.label, kind: b.k }); from = null; } } });
    try { await put(`/club/schedule/${id}`, { items: [...kept, ...items] }); setMsg({ ok: true, text: "Enregistré ✓ Il le voit dans « Mon planning »." }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }

  return (
    <div className="grid gap-3 rounded border-2 border-line bg-[#faf7ef] p-3 sm:p-4">
      <div>
        <h3 className="m-0 text-lg">🗓️ Planning de {name}</h3>
        <p className="m-0 mt-1 text-sm text-muted">1. Choisis ce que tu veux placer. 2. Touche les cases (une case = une heure, de 9 h à 22 h). Touche un jour ou une heure pour remplir toute la ligne.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Que placer ?">
        {BRUSHES.map((b) => <button key={b.k} type="button" aria-pressed={brush === b.k} onClick={() => setBrush(b.k)} className="rounded-full border-2 px-3 py-2 text-sm font-bold" style={brush === b.k ? { background: b.bg, color: "#fff", borderColor: b.bg } : { background: "#fff", color: "#17140f", borderColor: b.bg }}>{b.label}</button>)}
        <button type="button" aria-pressed={brush === null} onClick={() => setBrush(null)} className={"rounded-full border-2 px-3 py-2 text-sm font-bold " + (brush === null ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}>🧽 Effacer</button>
      </div>
      {!ready ? (msg ? <p role="alert" className="m-0 font-bold text-bad">{msg.text}</p> : <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-1 text-center text-sm">
            <thead><tr><th className="w-16" />{DAYS.map((d, wd) => <th key={d}><button type="button" onClick={() => toggleDay(wd)} className="w-full rounded bg-ink px-1 py-1.5 font-bold text-white">{d.slice(0, 3)}<span className="max-sm:hidden">{d.slice(3)}</span></button></th>)}</tr></thead>
            <tbody>
              {HOURS.map((h) => (
                <tr key={h}>
                  <th scope="row"><button type="button" onClick={() => toggleHour(h)} className="w-full rounded border border-line bg-white px-1 py-1 text-xs font-bold">{h} h – {h + 1} h</button></th>
                  {DAYS.map((d, wd) => { const v = on.get(key(wd, h)); const b = v ? brushOf(v) : null; return (
                    <td key={wd}>
                      <button type="button" aria-label={`${d}, ${h} h : ${b ? b.label : "rien de prévu"}`} onClick={() => toggle(key(wd, h))} className="h-9 w-full rounded border-2 text-[11px] font-bold leading-none" style={b ? { background: b.bg, borderColor: b.bg, color: "#fff" } : { background: "#fff", borderColor: "#d8cfbb" }}>{b ? b.short : ""}</button>
                    </td>); })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3"><button className="btn-ink" disabled={!ready} onClick={save}>🔄 Enregistrer le planning</button>{msg && ready && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
    </div>
  );
}
