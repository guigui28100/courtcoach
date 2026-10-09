import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api";
import { currentSeason, Evaluation, fullName, Player, ratedCount } from "../types";
import { StartBilan } from "./CoachFollowUp";
import { Avatar, Empty } from "./ui";

// Onglet « Évaluation de départ » du Centre : tous les jeunes d'un coup d'œil, et le bilan de départ se remplit ici (même formulaire que dans la fiche du joueur)
export function StartEvalTab({ players }: { players: Player[] }) {
  const season = currentSeason();
  const [status, setStatus] = useState<Record<string, Evaluation | undefined> | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    Promise.all(players.map(async (p) => [p.id, (await get<Evaluation[]>(`/players/${p.id}/evaluations`).catch(() => [] as Evaluation[])).find((e) => e.season === season && e.trimester === 0)] as const)).then((rows) => setStatus(Object.fromEntries(rows)));
  }, [players, version, season]);

  const chosen = players.find((p) => p.id === pick);
  if (chosen) {
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3"><button className="btn-outline btn-sm" onClick={() => setPick(null)}>← Tous les jeunes</button><h2 className="m-0 text-xl">📍 Évaluation de départ de {fullName(chosen)}</h2></div>
        <StartBilan key={chosen.id} p={chosen} season={season} t={0} saved={status?.[chosen.id]} onSaved={() => setVersion((v) => v + 1)} />
        <p className="m-0"><Link to={`/coach/centre/${chosen.id}/bulletin/${season}/0`} className="btn-outline btn-sm no-underline">📄 Voir le bulletin de départ</Link></p>
      </div>
    );
  }
  if (!players.length) return <Empty>Aucun jeune pour l'instant : ajoute le premier dans « Mes joueurs ».</Empty>;
  const done = (id: string) => ratedCount(status?.[id]) > 0;
  const sorted = [...players].sort((a, b) => Number(done(a.id)) - Number(done(b.id)) || fullName(a).localeCompare(fullName(b)));
  const nbDone = players.filter((p) => done(p.id)).length;
  return (
    <div className="grid gap-4">
      <p className="alert m-0"><strong>Évaluation de départ, saison {season.replace("-", "/")}.</strong> Au début de l'année, tu notes chaque jeune de 1 à 5 dans les 5 domaines, tu écris deux phrases, et tu crées les missions à travailler. C'est son <strong>point de départ</strong> (son « araignée »).</p>
      {status === null ? <div className="skeleton h-24" role="status" aria-label="Chargement en cours" /> : (
        <>
          <p className="m-0 font-bold">{nbDone} sur {players.length} évaluation{players.length > 1 ? "s" : ""} faite{nbDone > 1 ? "s" : ""}</p>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {sorted.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center gap-3">
                <Avatar name={fullName(p)} size={44} />
                <div className="min-w-0 flex-1"><strong className="block truncate">{fullName(p)}</strong><span className={"badge " + (done(p.id) ? "!bg-[#e4f6ea] !text-[#166534]" : "!bg-[#fff1d6] !text-[#8a5a00]")}>{done(p.id) ? "✅ Fait" : "⏳ À faire"}</span></div>
                <button className={done(p.id) ? "btn-outline btn-sm" : "btn-clay btn-sm"} onClick={() => setPick(p.id)}>{done(p.id) ? "Modifier" : "Faire le bilan"}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
