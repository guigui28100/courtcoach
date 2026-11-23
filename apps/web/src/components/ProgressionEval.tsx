import { useState } from "react";
import { AnnualGoal, Check, DIAG, DOMAINS, domainAvg, Group, Mark, SCALE } from "../progression";

const MARKS: [Mark, string, string][] = [["acquis", "Acquis", "#2c9a5b"], ["cours", "En cours d'acquisition", "#e8920c"], ["non", "Non acquis", "#d64545"]];
const keyOf = (o: AnnualGoal) => DIAG[o.d].find((c) => c.label === o.skill)?.key;
const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(1).replace(".", ","));

// Étape 4 : les bilans intermédiaires (séances 10 et 20) et le bilan final (séance 30), comparés au diagnostic de départ ; puis le cycle suivant.
export function Eval({ g, upd, onNextCycle }: { g: Group; upd: (p: Partial<Group>) => void; onNextCycle: () => void }) {
  const goals = g.goals || []; const checks = g.checks || {}; const done = g.sessions.filter((s) => s.done).length;
  const [at, setAt] = useState<"10" | "20" | "30">(done >= 30 ? "30" : done >= 20 ? "20" : "10");
  const cur: Check = checks[at] ?? { text: "", marks: {}, scores: {} };
  const save = (p: Partial<Check>) => upd({ checks: { ...checks, [at]: { ...cur, ...p } } });
  const score = (k: string, v: number) => { const sc = { ...cur.scores }; if (sc[k] === v) delete sc[k]; else sc[k] = v; save({ scores: sc }); };
  const mark = (id: string, m: Mark) => { const mk = { ...cur.marks }; if (mk[id] === m) delete mk[id]; else mk[id] = m; save({ marks: mk }); };
  const last = (["30", "20", "10"] as const).map((k) => checks[k]).find((c) => c && Object.keys(c.scores).length);
  const totals = { acquis: 0, cours: 0, non: 0 }; for (const m of Object.values(cur.marks)) totals[m]++;
  if (!goals.length) return <section className="grid gap-2"><h2 className="m-0 font-serif text-2xl font-bold">Évaluation de la progression</h2><p className="m-0 text-muted">Définis d'abord les objectifs annuels (étape « Objectifs ») : les bilans s'appuient sur eux.</p></section>;
  return (
    <section className="grid gap-5">
      <div className="grid gap-1"><h2 className="m-0 font-serif text-2xl font-bold">Évaluation de la progression</h2><p className="m-0 text-muted">{done} séance{done > 1 ? "s" : ""} réalisée{done > 1 ? "s" : ""} sur {g.sessions.length || 30}. Compare avec le diagnostic de départ, objectif par objectif.</p></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Bilan">{(["10", "20", "30"] as const).map((k) => <button key={k} type="button" aria-pressed={at === k} onClick={() => setAt(k)} className={`rounded-full border-2 px-4 py-2 font-bold ${at === k ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{k === "30" ? "Bilan final (séance 30)" : `Bilan de la séance ${k}`}{checks[k] && (Object.keys(checks[k].marks).length || checks[k].text) ? " ●" : ""}</button>)}</div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{DOMAINS.map((d) => { const a = domainAvg(g.diag, d.key), merged = { ...(g.diag || {}), ...(last?.scores || {}), ...cur.scores }, b = domainAvg(merged, d.key); const up = a !== null && b !== null ? b - a : 0;
        return <div key={d.key} className="rounded-xl border-2 bg-white p-3" style={{ borderColor: d.color }}><b style={{ color: d.color }}>{d.label}</b><p className="m-0 mt-1 text-sm">Départ : {fmt(a)} sur 4</p><p className="m-0 text-sm">Maintenant : {fmt(b)} sur 4</p>{a !== null && b !== null && <p className="m-0 text-sm font-bold" style={{ color: up > 0 ? "#2c9a5b" : up < 0 ? "#d64545" : "#6b6558" }}>{up > 0 ? "+" : ""}{up.toFixed(1).replace(".", ",")}</p>}</div>; })}</div>

      <div className="grid gap-3">
        {goals.map((o) => { const k = keyOf(o), start = k ? g.diag?.[k] : undefined, now = k ? cur.scores[k] : undefined, d = DOMAINS.find((x) => x.key === o.d)!; const hint = now === undefined ? null : now >= 3 ? "acquis" : now === 2 ? "cours" : "non";
          return (
            <article key={o.id} className="grid gap-2 rounded-xl border border-line bg-white p-3" style={{ borderLeft: `5px solid ${d.color}` }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><b>{o.skill}</b><span className="text-xs font-bold" style={{ color: d.color }}>{d.label}</span></div>
              {start !== undefined && <p className="m-0 text-sm text-muted">Au départ : {start} sur 4 ({SCALE[start].toLowerCase()})</p>}
              {k && <div role="group" aria-label={`Niveau actuel : ${o.skill}`} className="grid grid-cols-5 gap-1">{SCALE.map((l, v) => <button key={v} type="button" aria-pressed={now === v} title={l} onClick={() => score(k, v)} className="min-h-10 rounded-md border border-line text-sm font-bold" style={now === v ? { background: d.color, color: "#fff", borderColor: d.color } : undefined}>{v}</button>)}</div>}
              <div role="group" aria-label={`Bilan : ${o.skill}`} className="grid gap-1 sm:grid-cols-3">{MARKS.map(([m, l, c]) => <button key={m} type="button" aria-pressed={cur.marks[o.id] === m} onClick={() => mark(o.id, m)} className="min-h-10 rounded-md border border-line px-2 text-sm font-bold" style={cur.marks[o.id] === m ? { background: c, color: "#fff", borderColor: c } : undefined}>{l}</button>)}</div>
              {hint && !cur.marks[o.id] && <p className="hint m-0">D'après la note : plutôt « {MARKS.find((m) => m[0] === hint)![1].toLowerCase()} ».</p>}
            </article>);
        })}
      </div>

      <p className="m-0 font-bold">{totals.acquis} acquis · {totals.cours} en cours d'acquisition · {totals.non} non acquis{goals.length - Object.keys(cur.marks).length > 0 ? ` · ${goals.length - Object.keys(cur.marks).length} pas encore évalué${goals.length - Object.keys(cur.marks).length > 1 ? "s" : ""}` : ""}</p>
      <label className="grid gap-1"><span className="text-sm font-bold">Ce que je retiens de ce bilan</span><textarea id="ev-text" className="input min-h-24" maxLength={900} value={cur.text} onChange={(e) => save({ text: e.target.value })} /></label>

      <div className="grid gap-2 rounded-xl border border-line bg-white p-4">
        <h3 className="m-0 text-lg">Préparer le cycle suivant</h3>
        <p className="m-0 text-sm text-muted">Crée un nouveau groupe avec les mêmes joueurs : les objectifs non acquis ou en cours deviennent le point de départ du prochain diagnostic. Ce cycle reste tel quel.</p>
        <div><button type="button" className="btn-clay" onClick={onNextCycle}>Créer le cycle suivant</button></div>
      </div>
    </section>
  );
}
