import { useState } from "react";
import { adaptSuggestions, Group, levelDef, phaseRange, PHASES, sessionFor, THEMES, LevelDef, Session, sessionCount, sessionColor, domainOf, sessionDomain, KIND_LABEL } from "../progression";
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

// Étape 4 : la programmation = seulement le thème de chaque séance (menu déroulant, ou écrit à la main)
export function Plan({ g, upd, create, next }: { g: Group; upd: (p: Partial<Group>) => void; create: () => void; next: () => void }) {
  const S = g.sessions; const L: LevelDef = levelDef(g.level); const n = S.length;
  const setTheme = (i: number, v: string) => {
    const s = S[i]; if (s.kind !== "theme") return;
    if (THEMES[v]) { const fil = s.fil.split(" : ")[0]; upd({ sessions: S.map((x, k) => (k === i ? { ...sessionFor(g, v, Math.min(2, Math.floor((i * 3) / n)), fil), done: x.done, note: x.note, blocks: x.blocks, mat: x.mat, date: x.date, ready: x.ready, after: x.after, gl: x.gl } : x)) }); }
    else upd({ sessions: S.map((x, k) => (k === i ? { ...x, theme: v || " ", title: v || x.title } : x)) });
  };
  if (!n) return (
    <section className="grid max-w-2xl gap-3 rounded-xl border border-line bg-white p-5">
      <h2 className="m-0 text-xl">Proposer la programmation</h2>
      <p className="m-0">{planSummary(g)}. L'outil choisit un thème pour chaque séance d'après l'analyse de départ et les objectifs ; tu pourras tout changer.</p>
      <div><button type="button" className="btn-clay" onClick={create}>Proposer la programmation ({sessionCount(g)} séances)</button></div>
    </section>);
  return (
    <section className="grid gap-4">
      <p className="m-0 text-sm text-muted">{planSummary(g)}. Un thème dure plusieurs séances de suite sur le même objectif : on répète pour progresser. Pour chaque séance, change le thème avec le menu ou écris le tien. Les objectifs détaillés se règlent à l'étape suivante.</p>
      <AdaptBanner g={g} upd={upd} />
      {PHASES.map((ph, p) => { const [a, b] = phaseRange(p, n); return (
        <details key={ph} open={p === 0} className="rounded-xl border border-line bg-white">
          <summary className="cursor-pointer rounded-xl bg-ink px-3 py-2 font-bold text-white">{ph} · séances {a + 1} à {b}</summary>
          <ul className="m-0 grid list-none gap-1 p-2">
            {S.slice(a, b).map((s: Session, k) => { const i = a + k; const free = s.kind === "theme" && !THEMES[s.theme]; const dom = sessionDomain(s); return (
              <li key={i} className="grid items-center gap-2 border-b border-line py-1.5 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)]">
                <b className="font-serif text-lg" style={{ color: sessionColor(s) }}>{i + 1}</b>
                {s.kind === "theme" ? (
                  <>
                    <select className="input" aria-label={`Thème de la séance ${i + 1}`} value={free ? OTHER : s.theme} onChange={(e) => setTheme(i, e.target.value === OTHER ? " " : e.target.value)}>
                      {L.ok.map((t) => <option key={t}>{t}</option>)}{!free && !L.ok.includes(s.theme) && <option>{s.theme}</option>}<option value={OTHER}>✏️ Autre : j'écris mon thème</option></select>
                    {free ? <input className="input" aria-label={`Mon thème, séance ${i + 1}`} maxLength={60} value={s.theme.trim()} placeholder="Mon thème" onChange={(e) => setTheme(i, e.target.value)} /> : <span className="text-sm text-muted" style={{ color: dom ? domainOf(dom).color : undefined }}>{dom ? domainOf(dom).label : ""}</span>}
                  </>) : <><span className="font-bold">{s.title}</span><span className="text-sm text-muted">{KIND_LABEL[s.kind]}</span></>}
              </li>); })}
          </ul>
        </details>); })}
      <div className="flex flex-wrap gap-3"><button type="button" className="btn-clay" onClick={next}>Voir les séances et leurs objectifs →</button></div>
    </section>);
}
