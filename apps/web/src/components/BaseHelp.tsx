import { baseOfObjective, BASE_CONTEXTS, BASE_NOTE } from "../techBase";

// Repères d'un objectif technique tiré du référentiel du club : à observer, défaut possible, cause à tester, consigne, exercice et critères.
// Rien n'est imposé : le prof garde la main (ce sont des propositions pédagogiques à valider sur le terrain).
export function BaseHelp({ text }: { text: string }) {
  const b = baseOfObjective(text);
  if (!b) return null;
  return (
    <details className="rounded-md border border-line bg-paper text-sm">
      <summary className="cursor-pointer px-3 py-2 font-semibold">Repères pour « {b.sub} »</summary>
      <div className="grid gap-2 border-t border-line p-3">
        <p className="m-0"><b>À observer :</b> {b.obs}</p>
        <p className="m-0"><b>Défaut possible :</b> {b.def}</p>
        <p className="m-0"><b>Cause à tester :</b> {b.hyp}</p>
        <p className="m-0"><b>Consigne :</b> {b.fix}</p>
        <p className="m-0"><b>Exercice possible :</b> {b.ex}</p>
        <ul className="m-0 grid list-none gap-1 p-0">{BASE_CONTEXTS.map((c) => <li key={c.key}><b>{c.label}</b> : {c.ok}</li>)}</ul>
        <p className="hint m-0">{BASE_NOTE}</p>
      </div>
    </details>
  );
}
