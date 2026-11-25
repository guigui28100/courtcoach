import { useState } from "react";
import { AnnualGoal, DOMAINS, Domain, goalFrom, goalSessions, Group, levelDef, objectiveOptions, proposeGoals, diagCount } from "../progression";

const PRIO = ["", "Haute", "Moyenne", "Basse"];
const NOUN: Record<Domain, string> = { tech: "technique", tact: "tactique", phys: "physique", ment: "mental" };

// Étape 3 : les objectifs de l'année, rangés par domaine. La technique est toujours visible ; la tactique, le physique et le mental s'ajoutent s'il y en a.
export function Goals({ g, upd, create }: { g: Group; upd: (p: Partial<Group>) => void; create: () => void }) {
  const goals = g.goals || []; const [msg, setMsg] = useState(""); const [open, setOpen] = useState<Domain[]>([]); const [details, setDetails] = useState("");
  const L = levelDef(g.level);
  const setGoals = (l: AnnualGoal[]) => upd({ goals: l.slice(0, 24), validated: false });
  const edit = (id: string, p: Partial<AnnualGoal>) => setGoals(goals.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const propose = () => { const l = proposeGoals(g); if (!l.length) { setMsg("Aucun critère noté 2 ou moins dans le diagnostic : choisis tes objectifs ci-dessous."); return; } setMsg(""); setGoals([...goals, ...l.filter((x) => !goals.some((o) => o.d === x.d && o.skill === x.skill))]); };
  const shown = DOMAINS.filter((d) => d.key === "tech" || open.includes(d.key) || goals.some((o) => o.d === d.key));
  const hidden = DOMAINS.filter((d) => !shown.includes(d));
  const nTech = goals.filter((o) => o.d === "tech").length;
  const bad = goals.some((o) => !o.skill.trim());
  return (
    <section className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="m-0 font-serif text-2xl font-bold">Les objectifs de l'année</h2>
        <p className="m-0 text-muted">Choisis ce que le groupe va travailler. Commence par la technique ; ajoute la tactique, le physique ou le mental seulement s'il y en a.</p>
      </div>

      {goals.length === 0 && diagCount(g) > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-champagne bg-paper p-4">
          <b>Gagne du temps :</b>
          <button type="button" className="btn-clay" onClick={propose}>Proposer mes objectifs d'après le diagnostic</button>
          {msg && <span role="status" className="text-sm font-bold text-[#935500]">{msg}</span>}
        </div>)}

      {goals.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-line bg-white p-4" aria-label="Résumé des objectifs">
          <b>{goals.length} objectif{goals.length > 1 ? "s" : ""} pour l'année</b>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{DOMAINS.map((d) => { const l = goals.filter((o) => o.d === d.key); return (
            <div key={d.key} className="rounded-lg border-l-4 bg-paper p-2 text-sm" style={{ borderColor: l.length ? d.color : "#e2dbc9" }}>
              <b style={{ color: d.color }}>{d.label} ({l.length})</b>
              {l.length ? <ul className="m-0 mt-1 list-disc pl-4">{l.map((o) => <li key={o.id} className="[overflow-wrap:anywhere]">{o.skill || "…"}</li>)}</ul> : <p className="m-0 text-xs text-muted">aucun</p>}
            </div>); })}</div>
        </div>)}

      {shown.map((d) => <DomainBlock key={d.key} d={d} g={g} goals={goals.filter((o) => o.d === d.key)} L={L} details={details} setDetails={setDetails}
        add={(text) => setGoals([...goals, goalFrom(d.key, text)])} edit={edit} remove={(id) => setGoals(goals.filter((x) => x.id !== id))} />)}

      {hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Et aussi, s'il y en a :</span>
          {hidden.map((d) => <button key={d.key} type="button" className="btn-outline btn-sm" onClick={() => setOpen([...open, d.key])}>＋ Un objectif {NOUN[d.key]}</button>)}
        </div>)}

      <div className="grid gap-3 rounded-xl border-2 border-ink bg-white p-4">
        {g.validated ? <p className="m-0 font-bold text-ok">✔ Objectifs validés ({goals.length}).</p>
          : <p className="m-0 text-sm text-muted">{goals.length ? `${goals.length} objectif${goals.length > 1 ? "s" : ""}${nTech ? "" : " (aucun en technique)"} : vérifie, puis valide.` : "Ajoute au moins un objectif (menu ci-dessus)."}</p>}
        {g.sessions.length > 0 && <p className="hint m-0">Des séances existent déjà : « Créer les 30 séances » les remplace par une nouvelle proposition.</p>}
        <div className="flex flex-wrap gap-3">
          {!g.validated
            ? <button type="button" className="btn-clay" disabled={!goals.length || bad} onClick={() => upd({ validated: true })}>✔ Valider les objectifs</button>
            : <><button type="button" className="btn-clay" onClick={create}>Créer les 30 séances d'après ces objectifs →</button><button type="button" className="btn-outline" onClick={() => upd({ validated: false })}>Modifier les objectifs</button></>}
        </div>
        {bad && !g.validated && <p className="hint m-0">Chaque objectif doit avoir un texte.</p>}
      </div>
    </section>
  );
}

function DomainBlock({ d, g, goals, L, add, edit, remove, details, setDetails }: { d: (typeof DOMAINS)[number]; g: Group; goals: AnnualGoal[]; L: ReturnType<typeof levelDef>; add: (t: string) => void; edit: (id: string, p: Partial<AnnualGoal>) => void; remove: (id: string) => void; details: string; setDetails: (id: string) => void }) {
  const [text, setText] = useState(""); const tech = d.key === "tech";
  const short = (o: string) => (o.includes(" : ") ? o.split(" : ").slice(1).join(" : ") : o);
  const options = objectiveOptions(d.key, L).filter((o) => !goals.some((x) => x.skill === short(o)));
  return (
    <article className="grid gap-3 rounded-xl border-2 bg-white p-4" style={{ borderColor: goals.length ? d.color : "#e2dbc9" }}>
      <h3 className="m-0 text-xl" style={{ color: d.color }}>{d.label} <span className="text-sm font-normal text-muted">({goals.length})</span></h3>
      {tech && goals.length === 0 && <p className="m-0 text-sm text-muted">Exemples : coup droit, revers, service, retour, volée, smash, jeu de jambes. Choisis dans le menu, tout est déjà rempli.</p>}
      {goals.map((o) => { const ses = goalSessions(g, o.id); const isOpen = details === o.id; return (
        <div key={o.id} className="grid gap-2 rounded-lg bg-paper p-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-center">
            <input id={`go-sk-${o.id}`} className="input" aria-label="Objectif" maxLength={120} value={o.skill} onChange={(e) => edit(o.id, { skill: e.target.value })} />
            <select id={`go-pr-${o.id}`} className="input" aria-label="Priorité" value={o.prio} onChange={(e) => edit(o.id, { prio: +e.target.value as 1 | 2 | 3 })}>{[1, 2, 3].map((p) => <option key={p} value={p}>Priorité {PRIO[p].toLowerCase()}</option>)}</select>
            <button type="button" className="btn-outline btn-sm" aria-label={`Supprimer l'objectif ${o.skill}`} onClick={() => remove(o.id)}>Supprimer</button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className="underline" aria-expanded={isOpen} onClick={() => setDetails(isOpen ? "" : o.id)}>{isOpen ? "Masquer les précisions" : "Préciser (facultatif)"}</button>
            {ses.length > 0 && <span className="text-muted">Séances : {ses.join(", ")}</span>}
          </div>
          {isOpen && (
            <div className="grid gap-2">
              <label className="grid gap-1"><span className="text-xs font-bold text-muted">Constat de départ</span><textarea id={`go-fi-${o.id}`} className="input min-h-16" maxLength={400} value={o.finding} onChange={(e) => edit(o.id, { finding: e.target.value })} /></label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1"><span className="text-xs font-bold text-muted">Résultat attendu</span><textarea id={`go-ex-${o.id}`} className="input min-h-16" maxLength={300} value={o.expected} onChange={(e) => edit(o.id, { expected: e.target.value })} /></label>
                <label className="grid gap-1"><span className="text-xs font-bold text-muted">Critères de réussite</span><textarea id={`go-ok-${o.id}`} className="input min-h-16" maxLength={400} value={o.ok} onChange={(e) => edit(o.id, { ok: e.target.value })} /></label>
              </div>
              <label className="grid gap-1"><span className="text-xs font-bold text-muted">Comment l'évaluer</span><input id={`go-ev-${o.id}`} className="input" maxLength={300} value={o.evalMode} onChange={(e) => edit(o.id, { evalMode: e.target.value })} /></label>
            </div>)}
        </div>); })}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <select id={`go-add-${d.key}`} className="input" value="" aria-label={`Choisir un objectif ${NOUN[d.key]}`} onChange={(e) => { if (e.target.value) add(e.target.value); }}>
          <option value="">＋ Choisir un objectif {NOUN[d.key]}…</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <div className="flex gap-2"><input id={`go-new-${d.key}`} className="input min-w-0 flex-1" maxLength={120} value={text} placeholder={`Ou l'écrire : mon objectif ${NOUN[d.key]}`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (text.trim()) { add(text); setText(""); } } }} />
          <button type="button" className="btn-outline btn-sm" onClick={() => { if (text.trim()) { add(text); setText(""); } }}>Ajouter</button></div>
      </div>
    </article>
  );
}
