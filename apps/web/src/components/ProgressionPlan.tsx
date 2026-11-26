import { useState } from "react";
import { adaptSuggestions, cyclesOf, Group, levelDef, phaseOf, PHASES, sessionFor, THEMES, LevelDef, sessionCount, sessionColor, domainOf, sessionDomain, KIND_LABEL } from "../progression";
import { planSummary } from "./ProgressionSchedule";

const OTHER = "__autre";

// La programmation s'adapte : suggestions d'après ce qui est atteint ou non (jamais appliquées toutes seules)
export function AdaptBanner({ g, upd }: { g: Group; upd: (p: Partial<Group>) => void }) {
  const [skip, setSkip] = useState<string[]>([]);
  const sug = adaptSuggestions(g).filter((x) => !skip.includes(x.text));
  if (!sug.length) return null;
  return (
    <div className="grid gap-2" role="status">
      {sug.map((x) => (
        <div key={x.id} className="grid gap-2 rounded-xl border-2 border-champagne bg-paper p-4">
          <b>Adapter la suite ?</b><p className="m-0 text-sm">{x.text}</p>
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-clay btn-sm" onClick={() => upd({ sessions: x.sessions })}>Oui, adapter</button><button type="button" className="btn-outline btn-sm" onClick={() => setSkip([...skip, x.text])}>Non, garder la programmation</button></div>
        </div>))}
    </div>);
}

// Étape 4 : la programmation = le thème de chaque CYCLE de séances (un thème dure plusieurs séances de suite : on répète pour progresser)
export function Plan({ g, upd, create, next }: { g: Group; upd: (p: Partial<Group>) => void; create: () => void; next: () => void }) {
  const S = g.sessions; const L: LevelDef = levelDef(g.level); const n = S.length;
  const setTheme = (a: number, b: number, v: string) => {
    upd({ sessions: S.map((x, k) => {
      if (k < a || k > b || x.kind !== "theme") return x;
      if (THEMES[v]) return { ...sessionFor(g, v, phaseOf(a, n), x.fil.split(" : ")[0], 0), done: x.done, note: x.note, blocks: x.blocks, mat: x.mat, date: x.date, ready: x.ready, after: x.after, gl: x.gl, rating: x.rating, redo: x.redo };
      return { ...x, theme: v || " ", title: v.trim() || x.title };
    }) });
  };
  if (!n) return (
    <section className="grid max-w-2xl gap-3 rounded-xl border border-line bg-white p-5">
      <h2 className="m-0 text-xl">Proposer la programmation</h2>
      <p className="m-0">{planSummary(g)}. L'outil choisit un thème pour chaque série de séances d'après l'analyse de départ et les objectifs ; tu pourras tout changer.</p>
      <div><button type="button" className="btn-clay" onClick={create}>Proposer la programmation ({sessionCount(g)} séances)</button></div>
    </section>);
  const cyc = cyclesOf(S); let lastPhase = -1;
  return (
    <section className="grid gap-3">
      <p className="m-0 text-sm text-muted">{planSummary(g)}. Un thème dure plusieurs séances de suite : on répète pour progresser. Change le thème d'une série avec son menu.</p>
      <AdaptBanner g={g} upd={upd} />
      <div className="grid gap-2">
        {cyc.map((c) => {
          const ph = phaseOf(c.a, n); const head = ph !== lastPhase; lastPhase = ph; const s = S[c.a]; const count = c.b - c.a + 1;
          const free = !c.single && !THEMES[s.theme]; const dom = sessionDomain(s); const done = S.slice(c.a, c.b + 1).filter((x) => x.done).length;
          const range = count > 1 ? `Séances ${c.a + 1} à ${c.b + 1}` : `Séance ${c.a + 1}`;
          return (
            <div key={c.a} className="grid gap-2">
              {head && <h3 className="m-0 mt-2 rounded bg-ink px-3 py-1.5 text-sm font-bold text-white">{PHASES[ph]}</h3>}
              <div className="grid items-center gap-2 rounded-xl border border-line bg-white p-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_auto]" style={{ borderLeft: `5px solid ${sessionColor(s)}` }}>
                <div className="leading-tight"><b>{range}</b>{count > 1 && <span className="block text-xs text-muted">{count} séances de suite{done ? ` · ${done} faite${done > 1 ? "s" : ""}` : ""}</span>}</div>
                {c.single ? <b className="[overflow-wrap:anywhere]">{s.title} <span className="text-sm font-normal text-muted">· {KIND_LABEL[s.kind]}</span></b> : (
                  <div className="grid gap-1.5">
                    <select className="input" aria-label={`Thème : ${range}`} value={free ? OTHER : s.theme} onChange={(e) => setTheme(c.a, c.b, e.target.value === OTHER ? " " : e.target.value)}>
                      {L.ok.map((t) => <option key={t}>{t}</option>)}{!free && !L.ok.includes(s.theme) && <option>{s.theme}</option>}<option value={OTHER}>✏️ Autre : j'écris mon thème</option></select>
                    {free && <input className="input" aria-label={`Mon thème : ${range}`} maxLength={60} value={s.theme.trim()} placeholder="Mon thème" onChange={(e) => setTheme(c.a, c.b, e.target.value)} />}
                  </div>)}
                {!c.single && dom && <span className="justify-self-start rounded-full px-2.5 py-0.5 text-xs font-bold text-white sm:justify-self-end" style={{ background: domainOf(dom).color }}>{domainOf(dom).label}</span>}
              </div>
            </div>); })}
      </div>
      <div className="flex flex-wrap gap-3"><button type="button" className="btn-clay" onClick={next}>Voir les séances et leurs objectifs →</button></div>
    </section>);
}
