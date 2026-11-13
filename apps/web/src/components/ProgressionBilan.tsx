import { useMemo, useState } from "react";
import { analyseText, BILAN_LEVELS, DOMAINS, Group, levelDef, THEME_NAMES, THEMES } from "../progression";

// Étape 1 : le prof PARLE de son groupe ; l'outil dit ce qu'il a compris ; le prof corrige, puis la programmation en part.
export function Bilan({ g, upd, next }: { g: Group; upd: (p: Partial<Group>) => void; next: () => void }) {
  const L = levelDef(g.level);
  const found = useMemo(() => analyseText(g.notes, g.level), [g.notes, g.level]);
  const [fine, setFine] = useState(false);
  const setLevel = (n: string, v: number) => { const b = { ...g.bilan }; if (b[n] === v) delete b[n]; else b[n] = v; upd({ bilan: b }); };
  const rated = Object.keys(g.bilan).filter((n) => L.ok.includes(n)).length;
  const pending = found.filter((f) => g.bilan[f.theme] === undefined);
  const validateAll = () => { const b = { ...g.bilan }; found.forEach((f) => { if (b[f.theme] === undefined) b[f.theme] = f.level; }); upd({ bilan: b }); };
  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <label htmlFor="g-notes" className="font-serif text-2xl font-bold">1 · Parle-moi de ton groupe</label>
        <p className="m-0 text-muted">Décris ce qu'ils savent faire et ce qui ne va pas, comme tu le dirais à un collègue. La programmation part de ce texte.</p>
        <textarea id="g-notes" className="input min-h-36 text-base" maxLength={2000} value={g.notes} onChange={(e) => upd({ notes: e.target.value })} placeholder="Ex. Bon coup droit, mais beaucoup de fautes en revers. Le service est souvent raté à la 2e balle. Ils bougent peu les jambes et s'énervent quand ils perdent un point. Peu de volées, ils restent au fond." />
        <p className="hint m-0">Pas de nom d'élève. {g.notes.length} / 2000 caractères.</p>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 font-serif text-2xl font-bold">2 · Ce que j'ai compris</h2>{pending.length > 0 && <button type="button" className="btn-clay btn-sm" onClick={validateAll}>✔ C'est juste, valider ({pending.length})</button>}</div>
        {found.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-line bg-white p-4 text-muted">{g.notes.trim() ? "Je n'ai reconnu aucun thème dans ton texte. Essaie des mots comme « revers », « service », « jambes », « volée », « concentration », ou précise ci-dessous thème par thème." : "Écris quelques phrases ci-dessus : je te dirai ce que j'en comprends."}</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {found.map((f) => {
              const d = DOMAINS.find((x) => x.key === THEMES[f.theme].d)!, set = g.bilan[f.theme], cur = set ?? f.level;
              return (
                <li key={f.theme} className="grid gap-2 rounded-xl border border-line bg-white p-3" style={{ borderTop: `4px solid ${d.color}` }}>
                  <div className="flex items-baseline justify-between gap-2"><b>{f.theme}</b><span className="text-xs font-bold uppercase tracking-wide" style={{ color: d.color }}>{d.label}</span></div>
                  <p className="m-0 border-l-2 border-line pl-2 text-sm italic text-muted">« {f.excerpt} »</p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Niveau : ${f.theme}`}>
                    {BILAN_LEVELS.map((b, i) => <button key={b.label} type="button" aria-pressed={cur === i} onClick={() => setLevel(f.theme, i)} style={cur === i ? { background: b.color, borderColor: b.color, color: "#fff", borderStyle: set === undefined ? "dashed" : "solid" } : undefined} className={`min-h-9 rounded-lg border-2 px-2 text-sm font-bold ${cur === i ? "" : "border-line bg-white text-ink hover:border-ink"}`}>{b.short}</button>)}
                  </div>
                  {set === undefined && <span className="text-xs text-muted">Proposé par l'outil : touche « Valider » ou change le niveau.</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <details open={fine} onToggle={(e) => setFine((e.target as HTMLDetailsElement).open)} className="rounded-xl border border-line bg-white p-3">
        <summary className="cursor-pointer font-bold">3 · Préciser thème par thème <span className="font-normal text-muted">(facultatif · {rated} thème{rated > 1 ? "s" : ""} noté{rated > 1 ? "s" : ""})</span></summary>
        <div className="mt-3 grid gap-4">
          {DOMAINS.map((d) => {
            const names = THEME_NAMES.filter((n) => THEMES[n].d === d.key && L.ok.includes(n));
            if (!names.length) return null;
            return (
              <fieldset key={d.key} className="m-0 grid gap-2 rounded-xl border border-line bg-paper p-3" style={{ borderTop: `4px solid ${d.color}` }}>
                <legend className="px-1 text-sm font-bold uppercase tracking-wide" style={{ color: d.color }}>{d.label}</legend>
                {names.map((n) => (
                  <div key={n} className="grid items-center gap-2 sm:grid-cols-[13rem_minmax(0,1fr)]">
                    <span className="font-semibold">{n}</span>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Niveau du groupe : ${n}`}>
                      {BILAN_LEVELS.map((b, i) => <button key={b.label} type="button" aria-pressed={g.bilan[n] === i} onClick={() => setLevel(n, i)} style={g.bilan[n] === i ? { background: b.color, borderColor: b.color, color: "#fff" } : undefined} className={`min-h-10 rounded-lg border-2 px-2.5 py-1 text-sm font-bold ${g.bilan[n] === i ? "" : "border-line bg-white text-ink hover:border-ink"}`}>{b.short}</button>)}
                    </div>
                  </div>
                ))}
              </fieldset>
            );
          })}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-clay" onClick={next}>Voir la programmation →</button>
        <span className="text-sm text-muted">Les thèmes « à acquérir » viennent en premier et reviennent le plus souvent. Même sans valider, le texte est pris en compte.</span>
      </div>
    </section>
  );
}
