import { Link } from "react-router-dom";
import { currentSeason, Player } from "../types";
import { StartBilan } from "./CoachFollowUp";
import { useFollowUp } from "./Suivi";
import { useState } from "react";

// Onglet « Évaluation de départ » du dossier d'un joueur : le bilan de début d'année (une note de 1 à 5 par domaine, deux phrases, les missions à travailler)
export function StartEvalPanel({ p, onGoto, onSaved }: { p: Player; onGoto?: (tab: "objectifs") => void; onSaved?: () => void }) {
  const season = currentSeason();
  const [version, setVersion] = useState(0);
  const { evals } = useFollowUp(p.id, version);
  const saved = evals?.find((e) => e.season === season && e.trimester === 0);
  return (
    <div className="grid gap-4">
      <StartBilan key={`${p.id}-${evals ? "ok" : "chargement"}`} p={p} season={season} t={0} saved={saved} onSaved={() => { setVersion((v) => v + 1); onSaved?.(); }} onGoto={onGoto} />
      <p className="m-0"><Link to={`/coach/centre/${p.id}/bulletin/${season}/0`} className="btn-outline btn-sm no-underline">📄 Voir le bulletin de départ</Link></p>
    </div>
  );
}
