import { useCallback, useEffect, useState } from "react";
import { get, put } from "../api";
import { ProfAgenda } from "./ProfAgenda";
import { Err } from "./ui";
import { Lesson, ProfMe, ProfSlot, todayIso } from "../types";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const HOURS = Array.from({ length: 13 }, (_, i) => 9 + i); // 9 h … 21 h : créneaux d'une heure entre 9 h et 22 h
const pad = (h: number) => String(h).padStart(2, "0") + ":00";
const key = (wd: number, h: number) => `${wd}-${h}`;

// Le coach (ou le président) coche, jour par jour et heure par heure, quand le professeur peut donner cours ; il voit aussi son agenda
export function ProfPlanning({ id, name }: { id: string; name: string }) {
  const [prof, setProf] = useState<ProfMe | null>(null);
  const [on, setOn] = useState<Set<string>>(new Set());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = useCallback((p: ProfMe) => {
    setProf(p);
    const s = new Set<string>();
    for (const sl of p.slots) if (sl.weekday !== null) for (let h = +sl.start.slice(0, 2); h < +sl.end.slice(0, 2); h++) if (HOURS.includes(h)) s.add(key(sl.weekday, h));
    setOn(s);
  }, []);
  const loadLessons = useCallback(() => { get<Lesson[]>("/lessons").then((all) => setLessons(all.filter((l) => l.profId === id))).catch(() => setLessons([])); }, [id]);
  useEffect(() => { get<ProfMe>(`/profs/${id}/slots`).then(apply).catch((e) => setMsg({ ok: false, text: (e as Error).message })); loadLessons(); }, [id, apply, loadLessons]);

  const toggle = (k: string) => setOn((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleDay = (wd: number) => setOn((o) => { const n = new Set(o); const all = HOURS.every((h) => n.has(key(wd, h))); for (const h of HOURS) all ? n.delete(key(wd, h)) : n.add(key(wd, h)); return n; });
  const toggleHour = (h: number) => setOn((o) => { const n = new Set(o); const all = DAYS.every((_, wd) => n.has(key(wd, h))); DAYS.forEach((_, wd) => (all ? n.delete(key(wd, h)) : n.add(key(wd, h)))); return n; });
  const busy = new Set(lessons.filter((l) => ["BOOKED", "ACCEPTED"].includes(l.status) && l.finalSlot && l.finalSlot.date >= todayIso()).map((l) => { const d = new Date(`${l.finalSlot!.date}T12:00:00Z`); return key((d.getUTCDay() + 6) % 7, +l.finalSlot!.time.slice(0, 2)); }));

  async function save() {
    setMsg(null);
    // On regroupe les heures qui se suivent en un seul créneau ; les dates précises déjà prévues sont gardées
    const weekly: { weekday: number; start: string; end: string }[] = [];
    DAYS.forEach((_, wd) => { let from: number | null = null; for (let h = 9; h <= 22; h++) { const yes = h < 22 && on.has(key(wd, h)); if (yes && from === null) from = h; if (!yes && from !== null) { weekly.push({ weekday: wd, start: pad(from), end: pad(h) }); from = null; } } });
    const dates = (prof?.slots ?? []).filter((s: ProfSlot) => s.date !== null).map((s) => ({ date: s.date, start: s.start, end: s.end }));
    try {
      const saved = await put<ProfMe>(`/profs/${id}/slots`, { slots: [...weekly, ...dates] });
      apply(saved); loadLessons();
      setMsg({ ok: true, text: saved.outsideCount ? `Enregistré ✓ — attention : ${saved.outsideCount} cours déjà réservé${saved.outsideCount > 1 ? "s" : ""} ne tombe${saved.outsideCount > 1 ? "nt" : ""} plus dans ces créneaux. Rien n'est annulé.` : "Enregistré ✓" });
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }

  if (!prof) return msg ? <Err msg={msg.text} /> : <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const total = on.size;
  return (
    <div className="grid gap-4 rounded border-2 border-line bg-[#faf7ef] p-3 sm:p-4">
      <div>
        <h3 className="m-0 text-lg">🗓️ Disponibilités de {name}</h3>
        <p className="m-0 mt-1 text-sm text-muted">Touche une case pour dire qu'il peut donner cours ce jour-là, à cette heure (créneaux d'une heure, de 9 h à 22 h). Touche le nom d'un jour ou une heure pour tout cocher d'un coup.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-center text-sm">
          <thead><tr><th className="w-16" />{DAYS.map((d, wd) => <th key={d}><button type="button" onClick={() => toggleDay(wd)} className="w-full rounded bg-ink px-1 py-1.5 font-bold text-white">{d.slice(0, 3)}<span className="max-sm:hidden">{d.slice(3)}</span></button></th>)}</tr></thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h}>
                <th scope="row"><button type="button" onClick={() => toggleHour(h)} className="w-full rounded border border-line bg-white px-1 py-1 text-xs font-bold">{h} h – {h + 1} h</button></th>
                {DAYS.map((d, wd) => { const k = key(wd, h); const yes = on.has(k); const taken = busy.has(k); return (
                  <td key={k}>
                    <button type="button" aria-pressed={yes} aria-label={`${d}, ${h} h : ${taken ? "cours réservé" : yes ? "disponible" : "non disponible"}`} onClick={() => toggle(k)}
                      className={"h-9 w-full rounded border-2 font-bold " + (taken ? "border-[#7a5a14] bg-[#ffe08a] text-ink" : yes ? "border-[#1d6b43] bg-[#1f7a45] text-white" : "border-line bg-white text-muted")}>{taken ? "🎾" : yes ? "✔" : ""}</button>
                  </td>); })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span><b className="text-[#1f7a45]">■</b> Disponible</span><span><b className="text-[#c9a227]">■</b> 🎾 Cours déjà réservé</span><span>□ Non disponible</span></p>
      <div className="flex flex-wrap items-center gap-3"><button className="btn-ink" onClick={save}>🔄 Enregistrer ({total} créneau{total > 1 ? "x" : ""} d'une heure)</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
      <div>
        <h3 className="m-0 mb-2 text-lg">📅 Son agenda</h3>
        <ProfAgenda lessons={lessons} slots={prof.slots} skipHolidays={prof.skipHolidays !== false} reload={() => { loadLessons(); get<ProfMe>(`/profs/${id}/slots`).then(apply).catch(() => {}); }} />
      </div>
    </div>
  );
}
