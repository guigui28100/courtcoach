import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fullName, Player } from "../types";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Pages que l'on peut aussi trouver en tapant un mot (le coach seulement)
const PAGES: { label: string; to: string; words: string }[] = [
  { label: "Donner des étoiles (fin de cours)", to: "/coach/centre/fin-de-cours", words: "etoile fin de cours dictee" },
  { label: "Vidéos et gestes à analyser", to: "/coach/centre?onglet=videos", words: "video geste analyse analyser" },
  { label: "Bulletins", to: "/coach/centre?onglet=bulletins", words: "bulletin trimestre" },
  { label: "Planning du club", to: "/coach/club", words: "planning club evenement tournoi stage affiche calendrier" },
  { label: "Partenaires (sponsoring)", to: "/coach/club/partenaires", words: "partenaire sponsor sponsoring contrat logo" },
  { label: "Cours particuliers : demandes et professeurs", to: "/coach/adultes", words: "cours adulte prof professeur demande reservation" },
  { label: "Mon agenda", to: "/coach/prof", words: "agenda cours particulier" },
  { label: "Planning des profs", to: "/coach/planning-profs", words: "planning profs entraineur semaine" },
  { label: "Sécurité et accès du club", to: "/coach/securite", words: "securite mot de passe double authentification acces president bureau" },
];

// Recherche rapide de l'accueil : un joueur (par son nom) ou une page. Touche « / » pour y aller. Tout se fait dans le navigateur, avec les joueurs que la personne a déjà le droit de voir.
export function QuickSearch({ players }: { players: Player[] }) {
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  const n = norm(q.trim());
  const ps = n ? players.filter((p) => norm(fullName(p)).includes(n) || norm(`${p.lastName} ${p.firstName}`).includes(n)).slice(0, 6) : [];
  const pages = n.length > 1 ? PAGES.filter((p) => norm(p.label + " " + p.words).includes(n)).slice(0, 4) : [];
  const items = [...ps.map((p) => ({ key: p.id, to: `/coach/centre/${p.id}`, label: fullName(p), sub: "Ouvrir le dossier", icon: "🎾" })), ...pages.map((p) => ({ key: p.to, to: p.to, label: p.label, sub: "Page", icon: "➡️" }))];
  const go = (to: string) => { setQ(""); setCur(0); nav(to); };
  return (
    <div className="relative mb-4 print:hidden">
      <label htmlFor="qs" className="sr-only">Chercher un joueur ou une page</label>
      <input id="qs" ref={input} type="search" autoComplete="off" role="combobox" aria-expanded={items.length > 0} aria-controls="qs-list" aria-autocomplete="list"
        className="input w-full !bg-[#26211a] !text-white placeholder:!text-[#a89c82]" placeholder="🔎 Chercher un joueur ou une page… (touche /)" value={q}
        onChange={(e) => { setQ(e.target.value); setCur(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && items.length) { e.preventDefault(); setCur((c) => (c + 1) % items.length); }
          else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); setCur((c) => (c - 1 + items.length) % items.length); }
          else if (e.key === "Enter" && items[cur]) { e.preventDefault(); go(items[cur].to); }
          else if (e.key === "Escape") setQ("");
        }} />
      {n && (
        <ul id="qs-list" role="listbox" className="absolute left-0 right-0 z-30 m-0 mt-1 grid list-none gap-0 overflow-hidden rounded border border-[#4a4234] bg-[#26211a] p-0 shadow-xl">
          {items.length === 0 && <li className="px-4 py-3 text-[#cfc5b0]">Aucun résultat pour « {q} ».</li>}
          {items.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === cur}>
              <Link to={it.to} onClick={() => { setQ(""); setCur(0); }} className={"flex items-center justify-between gap-3 px-4 py-3 text-white no-underline " + (i === cur ? "bg-[#3a3326]" : "hover:bg-[#312b21]")}>
                <span className="min-w-0 [overflow-wrap:anywhere]"><span aria-hidden="true">{it.icon} </span><strong>{it.label}</strong></span>
                <small className="shrink-0 text-[#a89c82]">{it.sub}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
