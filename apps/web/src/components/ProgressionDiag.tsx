import { useState } from "react";
import { DIAG, diagCount, diagTotal, DOMAINS, domainAvg, Group, SCALE, SCALE_HELP } from "../progression";

// Étape 1 : le diagnostic initial. Chaque critère de chaque domaine est noté de 0 à 4 ; le prof écrit ses observations (collectives, puis par joueur).
export function Diag({ g, upd, next }: { g: Group; upd: (p: Partial<Group>) => void; next: () => void }) {
  const diag = g.diag || {}; const obs = g.diagObs || {}; const pobs = g.playerObs || {}; const names = g.players || [];
  const [who, setWho] = useState(names[0] || "");
  const set = (k: string, v: number) => { const d = { ...diag }; if (d[k] === v) delete d[k]; else d[k] = v; upd({ diag: d }); };
  const n = diagCount(g), total = diagTotal();
  const player = names.includes(who) ? who : names[0] || "";
  return (
    <section className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="m-0 font-serif text-2xl font-bold">Diagnostic du groupe</h2>
        <p className="m-0 text-muted">Observe le groupe avant de programmer : note chaque critère de 0 à 4. Tu peux laisser vide ce que tu n'as pas observé.</p>
        <p className="hint m-0">{SCALE_HELP}.</p>
        <p className="m-0 font-bold">{n} critère{n > 1 ? "s" : ""} noté{n > 1 ? "s" : ""} sur {total}</p>
      </div>

      {DOMAINS.map((d) => {
        const avg = domainAvg(diag, d.key); const low = DIAG[d.key].filter((c) => diag[c.key] !== undefined && diag[c.key] <= 1).length;
        return (
          <article key={d.key} className="grid gap-3 rounded-xl border-2 bg-white p-4" style={{ borderColor: d.color }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="m-0 text-xl" style={{ color: d.color }}>{d.label}</h3><span className="text-sm text-muted">{avg === null ? "pas encore noté" : `moyenne ${avg.toFixed(1).replace(".", ",")} sur 4`}{low ? ` · ${low} difficulté${low > 1 ? "s" : ""} prioritaire${low > 1 ? "s" : ""}` : ""}</span></div>
            <ul className="m-0 grid list-none gap-3 p-0">{DIAG[d.key].map((c) => (
              <li key={c.key} className="grid gap-1.5 border-t border-line pt-3 first:border-0 first:pt-0">
                <span className="font-bold">{c.label}{diag[c.key] !== undefined && diag[c.key] <= 1 && <span className="ml-2 rounded bg-[#b5483a] px-1.5 py-0.5 text-xs font-bold text-white">prioritaire</span>}</span>
                <div role="group" aria-label={c.label} className="grid grid-cols-5 gap-1">{SCALE.map((l, v) => (
                  <button key={v} type="button" aria-pressed={diag[c.key] === v} title={l} onClick={() => set(c.key, v)} className="min-h-11 rounded-md border border-line px-1 text-sm font-bold" style={diag[c.key] === v ? { background: d.color, color: "#fff", borderColor: d.color } : undefined}>
                    <span className="block text-base">{v}</span><span className="hidden text-[10px] font-normal leading-tight sm:block">{l}</span></button>))}</div>
              </li>))}</ul>
            <label className="grid gap-1"><span className="text-sm font-bold">Observations du groupe en {d.label.toLowerCase()} : points forts et difficultés</span>
              <textarea id={`dg-obs-${d.key}`} className="input min-h-20" maxLength={900} value={obs[d.key] || ""} onChange={(e) => upd({ diagObs: { ...obs, [d.key]: e.target.value } })} placeholder="Ce que tu as vu : sans nom de famille." /></label>
          </article>
        );
      })}

      <article className="grid gap-3 rounded-xl border border-line bg-white p-4">
        <h3 className="m-0 text-xl">Observations individuelles</h3>
        {!names.length ? <p className="m-0 text-muted">Ajoute les prénoms dans l'onglet « Groupe et appel » pour noter des observations par joueur.</p> : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Joueur">{names.map((nm) => <button key={nm} type="button" aria-pressed={nm === player} onClick={() => setWho(nm)} className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${nm === player ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{nm}{pobs[nm] ? " ●" : ""}</button>)}</div>
            <label className="grid gap-1"><span className="text-sm font-bold">{player} : ce qui le distingue du groupe</span>
              <textarea id="dg-player" className="input min-h-24" maxLength={600} value={pobs[player] || ""} onChange={(e) => upd({ playerObs: { ...pobs, [player]: e.target.value } })} placeholder="Points forts, difficultés, besoins particuliers…" /></label>
            <p className="hint m-0">Un point plein ● signale un joueur qui a déjà une observation. Visible de toi seul.</p>
          </>)}
      </article>

      <div className="flex flex-wrap gap-3"><button type="button" className="btn-clay" onClick={next}>Passer aux objectifs annuels →</button></div>
    </section>
  );
}
