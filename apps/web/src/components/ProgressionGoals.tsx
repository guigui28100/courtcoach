import { useState } from "react";
import { AnnualGoal, DOMAINS, Domain, goalSessions, Group, newGoalId, proposeGoals } from "../progression";

const PRIO = ["", "Haute", "Moyenne", "Basse"];
// Étape 2 : les objectifs annuels, proposés d'après le diagnostic. Le prof accepte, modifie, supprime ou ajoute ; la programmation ne part qu'après sa validation.
export function Goals({ g, upd, next }: { g: Group; upd: (p: Partial<Group>) => void; next: () => void }) {
  const goals = g.goals || []; const [ask, setAsk] = useState(false); const [msg, setMsg] = useState("");
  const setGoals = (l: AnnualGoal[]) => upd({ goals: l, validated: false });
  const edit = (id: string, p: Partial<AnnualGoal>) => setGoals(goals.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const propose = () => { const l = proposeGoals(g); if (!l.length) { setMsg("Aucun critère noté 2 ou moins dans le diagnostic : note d'abord le groupe, ou ajoute tes objectifs à la main."); return; } setMsg(""); setGoals(l); setAsk(false); };
  const add = (d: Domain) => setGoals([...goals, { id: newGoalId(), d, skill: "", finding: "", expected: "", ok: "", prio: 2 as const, evalMode: "Observation en situation de jeu, bilans après les séances 10, 20 et 30" }].slice(0, 24));
  const field = "input";
  return (
    <section className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="m-0 font-serif text-2xl font-bold">Objectifs annuels</h2>
        <p className="m-0 text-muted">Ils viennent du diagnostic. Accepte, modifie, supprime ou ajoute : rien n'est programmé tant que tu n'as pas validé.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!goals.length || ask ? <button type="button" className="btn-clay" onClick={propose}>{goals.length ? "Remplacer par une nouvelle proposition" : "Proposer les objectifs d'après le diagnostic"}</button>
          : <button type="button" className="btn-outline" onClick={() => setAsk(true)}>↻ Proposer à nouveau d'après le diagnostic</button>}
        {ask && <button type="button" className="btn-outline" onClick={() => setAsk(false)}>Annuler</button>}
        {msg && <p role="status" className="m-0 text-sm font-bold text-[#935500]">{msg}</p>}
      </div>

      {DOMAINS.map((d) => {
        const list = goals.filter((o) => o.d === d.key);
        return (
          <article key={d.key} className="grid gap-3 rounded-xl border-2 bg-white p-4" style={{ borderColor: list.length ? d.color : "#e2dbc9" }}>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="m-0 text-xl" style={{ color: d.color }}>{d.label} <span className="text-sm font-normal text-muted">({list.length})</span></h3><button type="button" className="btn-outline btn-sm" onClick={() => add(d.key)}>＋ Ajouter un objectif</button></div>
            {list.length === 0 && <p className="m-0 text-sm text-muted">Aucun objectif en {d.label.toLowerCase()}.</p>}
            {list.map((o) => { const ses = goalSessions(g, o.id); return (
              <div key={o.id} className="grid gap-2 rounded-lg bg-paper p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Compétence à développer</span><input id={`go-sk-${o.id}`} className={field} maxLength={120} value={o.skill} onChange={(e) => edit(o.id, { skill: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Priorité</span><select id={`go-pr-${o.id}`} className={field} value={o.prio} onChange={(e) => edit(o.id, { prio: +e.target.value as 1 | 2 | 3 })}>{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}</select></label>
                  <button type="button" className="btn-outline btn-sm" aria-label={`Supprimer l'objectif ${o.skill}`} onClick={() => setGoals(goals.filter((x) => x.id !== o.id))}>Supprimer</button>
                </div>
                <label className="grid gap-1"><span className="text-xs font-bold text-muted">Constat initial qui justifie cet objectif</span><textarea id={`go-fi-${o.id}`} className={`${field} min-h-16`} maxLength={400} value={o.finding} onChange={(e) => edit(o.id, { finding: e.target.value })} /></label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Résultat attendu</span><textarea id={`go-ex-${o.id}`} className={`${field} min-h-16`} maxLength={300} value={o.expected} onChange={(e) => edit(o.id, { expected: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Critères de réussite observables</span><textarea id={`go-ok-${o.id}`} className={`${field} min-h-16`} maxLength={400} value={o.ok} onChange={(e) => edit(o.id, { ok: e.target.value })} /></label>
                </div>
                <label className="grid gap-1"><span className="text-xs font-bold text-muted">Modalités d'évaluation</span><input id={`go-ev-${o.id}`} className={field} maxLength={300} value={o.evalMode} onChange={(e) => edit(o.id, { evalMode: e.target.value })} /></label>
                <p className="m-0 text-sm text-muted">Séances concernées : {ses.length ? ses.join(", ") : g.sessions.length ? "aucune pour l'instant" : "elles apparaîtront après la création des 30 séances"}</p>
              </div>); })}
          </article>
        );
      })}

      <div className="grid gap-2 rounded-xl border border-line bg-white p-4">
        {g.validated ? <p className="m-0 font-bold text-ok">Objectifs validés ({goals.length}). Tu peux maintenant créer les 30 séances.</p>
          : <p className="m-0 text-sm text-muted">{goals.length ? `${goals.length} objectif${goals.length > 1 ? "s" : ""} à valider.` : "Ajoute au moins un objectif pour pouvoir valider."}</p>}
        {g.sessions.length > 0 && <p className="hint m-0">Des séances existent déjà : valider ou modifier les objectifs ne les change pas. Tu peux relancer la proposition des séances dans l'onglet « Séances ».</p>}
        <div className="flex flex-wrap gap-3">
          {!g.validated ? <button type="button" className="btn-clay" disabled={!goals.length || goals.some((o) => !o.skill.trim())} onClick={() => upd({ validated: true })}>✔ Valider les objectifs</button>
            : <><button type="button" className="btn-clay" onClick={next}>Programmer les 30 séances →</button><button type="button" className="btn-outline" onClick={() => upd({ validated: false })}>Modifier à nouveau</button></>}
        </div>
        {!g.validated && goals.some((o) => !o.skill.trim()) && <p className="hint m-0">Chaque objectif doit avoir une compétence.</p>}
      </div>
    </section>
  );
}
