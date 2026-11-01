import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { QuickSearch } from "../components/QuickSearch";
import { Avatar } from "../components/ui";
import { fullName, Player } from "../types";

// Espace V2 : un aperçu réservé au COACH, à côté de la V1 (qui ne change pas).
// Rien n'est écrit ici : on lit seulement la liste des joueurs que le coach a déjà le droit de voir, et chaque lien ouvre la page habituelle de la V1.
const BOX = "rounded border-2 border-[#1d2f55] bg-white p-4";
const H = "m-0 font-display text-sm font-extrabold uppercase tracking-[0.14em] text-[#1d2f55]";

export default function V2() {
  const { me } = useAuth();
  const [players, setPlayers] = useState<Player[] | null>(null);
  useEffect(() => { get<Player[]>("/players").then(setPlayers).catch(() => setPlayers([])); }, []);
  const hour = new Date().getHours();
  const first = me?.firstName?.trim() || "coach";
  const tiles: [string, string, string][] = [
    ["Donner des étoiles", "Un joueur à la fois, après le cours", "/coach/centre/fin-de-cours"],
    ["Vidéos et gestes", "À analyser, à envoyer", "/coach/centre?onglet=videos"],
    ["Bulletins", "Départ et trimestres", "/coach/centre?onglet=bulletins"],
    ["Planning du club", "Événements, affiches, export", "/coach/club"],
    ["Partenaires", "Sponsoring, dossier, contrat", "/coach/club/partenaires"],
    ["Cours particuliers", "Demandes et professeurs", "/coach/adultes"],
  ];
  const next = [
    "Carte du joueur et sentier de la saison",
    "Dictée des étoiles et mode séance",
    "Geste fantôme dans le studio",
    "Résumé du dimanche pour les parents (message préparé, sans détail)",
    "Tableau des courts en direct",
    "Bilan de saison en juin",
  ];
  return (
    <div className="mx-auto grid max-w-6xl gap-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 rounded bg-[#1d2f55] p-5 text-white">
        <div className="min-w-0">
          <p className="m-0 font-mono text-xs uppercase tracking-[0.16em] text-[#c9d6ff]">Aperçu V2 · réservé au coach</p>
          <h1 className="m-0 mt-1 text-3xl text-white sm:text-4xl">{hour < 18 ? "Bonjour" : "Bonsoir"} {first}</h1>
          <p className="m-0 mt-1 text-[#dfe6ff]">Ici on essaie la nouvelle version. La V1 n'est pas touchée : tous les liens ouvrent les pages habituelles.</p>
        </div>
        <Link to="/coach" className="btn-outline !border-white !bg-transparent !text-white no-underline hover:!bg-white hover:!text-[#1d2f55]">← Revenir à la V1</Link>
      </header>

      <QuickSearch players={players ?? []} />

      <section className={BOX} aria-label="Raccourcis">
        <h2 className={H}>Aller directement</h2>
        <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(([t, s, to]) => (
            <li key={to}><Link to={to} className="block h-full rounded border border-line bg-sand/50 p-4 text-ink no-underline hover:border-[#1d2f55] hover:bg-white"><strong className="block text-lg">{t}</strong><span className="text-muted">{s}</span></Link></li>
          ))}
        </ul>
      </section>

      <section className={BOX} aria-label="Mes joueurs">
        <h2 className={H}>Mes joueurs {players ? `(${players.length})` : ""}</h2>
        {players === null && <div className="skeleton mt-3 h-24" role="status" aria-label="Chargement en cours" />}
        {players && !players.length && <p className="mt-3 text-muted">Aucun joueur pour l'instant.</p>}
        {players && players.length > 0 && (
          <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <li key={p.id} className="min-w-0"><Link to={`/coach/centre/${p.id}`} className="flex items-center gap-3 rounded border border-line bg-white p-3 text-ink no-underline hover:border-[#1d2f55]"><Avatar name={fullName(p)} size={44} /><strong className="min-w-0 [overflow-wrap:anywhere]">{fullName(p)}</strong></Link></li>
            ))}
          </ul>
        )}
      </section>

      <section className={BOX} aria-label="Ce qui arrive">
        <h2 className={H}>Ce qui arrive dans la V2</h2>
        <p className="mt-2 text-muted">Chaque nouveauté sera ajoutée ici, une par une, et testée par vous avant d'être proposée aux autres.</p>
        <ul className="m-0 mt-2 grid gap-1.5 pl-5">{next.map((n) => <li key={n}>{n}</li>)}</ul>
      </section>
    </div>
  );
}
