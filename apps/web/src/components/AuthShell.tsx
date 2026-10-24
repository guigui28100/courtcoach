import { ReactNode, useState } from "react";
import { CourtLines } from "./CourtLines";

// Habillage des pages de connexion : un panneau « terrain de tennis » à gauche, le formulaire à droite (en haut sur téléphone).
export function AuthShell({ eyebrow, title, subtitle, children, tour }: { eyebrow?: string; title: string; subtitle?: ReactNode; children: ReactNode; tour?: boolean }) {
  return (
    <>
    <div className="grid lg:min-h-[calc(100dvh-125px)] lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative overflow-hidden bg-gradient-to-br from-clay to-[#7d2d12] px-6 py-8 text-white lg:px-12 lg:py-14" aria-label="Présentation">
        <svg viewBox="0 0 260 120" className="pointer-events-none absolute -bottom-6 -right-10 w-[22rem] text-white/15 max-lg:hidden" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <CourtLines cx={130} y={6} h={108} netWidth={4} />
        </svg>
        <div className="relative grid max-w-md gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ball shadow-lg" aria-hidden="true">
            <svg viewBox="0 0 32 32" className="h-9 w-9"><circle cx="16" cy="16" r="15" fill="#dcf247" /><path d="M5 6c6 5 6 15 0 20M27 6c-6 5-6 15 0 20" fill="none" stroke="#10203a" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-white/80">Tennis Club Houdan</p>
            <p className="m-0 mt-1 font-display text-3xl font-black leading-tight lg:text-4xl" style={{ fontStretch: "85%" }}>Ton coach analyse ton geste, tu progresses.</p>
          </div>
          <ul className="m-0 grid list-none gap-2.5 p-0 text-white/90 max-lg:hidden">
            {["Tes vidéos et les conseils de ton coach, au même endroit", "Objectifs et bulletins de l'année pour les jeunes du Centre", "Données protégées : aucune publicité, aucun suivi"].map((t) => (
              <li key={t} className="flex items-start gap-2.5"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold" aria-hidden="true">✓</span>{t}</li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="grid content-center bg-gradient-to-b from-chalk to-sand/50 px-4 py-8 sm:px-8 lg:py-14">
        <div className="mx-auto grid w-full max-w-md gap-5">
          <header>
            {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-clay">{eyebrow}</p>}
            <h1 className="mb-1">{title}</h1>
            {subtitle && <p className="m-0 text-muted">{subtitle}</p>}
          </header>
          {children}
        </div>
      </section>
    </div>
    {tour && <SiteTour />}
    </>
  );
}

const TOUR: { icon: string; title: string; who: string; items: string[] }[] = [
  { icon: "🙋", title: "Adultes", who: "Inscription libre, depuis cette page", items: ["Réserver un cours particulier : tu choisis ton professeur, puis un créneau libre dans son planning", "Le professeur confirme, tu vois le tarif avant de réserver (adhérent ou non)", "Envoyer une vidéo de ton jeu : le coach l'analyse et te répond, avec une discussion liée à l'analyse", "Ton profil, le téléchargement et la suppression de tes données à tout moment"] },
  { icon: "🚀", title: "Jeunes du Centre de compétition", who: "Accès créé par le coach, sur invitation", items: ["Tes missions du trimestre et tes étoiles gagnées après chaque cours", "Ta toile de progrès : ton point de départ et où tu en es", "Tes vidéos analysées, ton geste de départ et son évolution", "Tes matchs, tes bilans de tournoi, tes bulletins et ton auto-évaluation"] },
  { icon: "👨‍👩‍👧", title: "Parents", who: "Accès par invitation du coach", items: ["Le même espace que l'enfant, pour suivre ses progrès", "Les autorisations (suivi, droit à l'image) données en ligne et retirables à tout moment", "La fiche de renseignements à compléter", "Jamais l'accès aux données d'un autre enfant"] },
  { icon: "👩‍🏫", title: "Professeurs et entraîneurs", who: "Comptes créés par le coach", items: ["Un agenda des cours particuliers : confirmer, libérer un créneau, arrêter une série", "Régler ses disponibilités et sa présentation", "Pour les entraîneurs du Centre : objectifs, étoiles, bilans et analyses vidéo de LEURS jeunes seulement"] },
  { icon: "🏟️", title: "Gestion du club", who: "Coach, président et bureau", items: ["Le planning de la saison : tournois, matchs par équipes, stages, animations, bulle, fêtes", "Les affiches des événements et du mois, à imprimer ou à partager en image", "Le dossier de saison en PDF et l'agenda pour le téléphone", "Le président gère les cours particuliers ; le bureau consulte le planning en lecture seule"] },
];

// Présentation de tout ce que fait le site, sous le formulaire de connexion (rien de personnel, aucun appel extérieur).
function SiteTour() {
  return (
    <section className="bg-sand/60 px-4 py-10 sm:px-8 lg:px-12" aria-labelledby="tour-title">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="max-w-2xl">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-clay">À quoi sert CourtCoach ?</p>
          <h2 id="tour-title" className="m-0">Tout le suivi du Tennis Club Houdan, au même endroit</h2>
          <p className="mt-2 text-muted">Chacun voit seulement ce qui le concerne. Les jeunes, leurs parents et les professeurs entrent par invitation du coach ; les adultes peuvent créer leur compte.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOUR.map((c) => (
            <article key={c.title} className="grid content-start gap-2 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
              <h3 className="m-0 flex items-center gap-2 text-lg"><span aria-hidden="true">{c.icon}</span>{c.title}</h3>
              <p className="m-0 text-xs font-bold uppercase tracking-wide text-clay">{c.who}</p>
              <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
                {c.items.map((t) => <li key={t} className="flex gap-2"><span className="text-clay" aria-hidden="true">•</span><span>{t}</span></li>)}
              </ul>
            </article>
          ))}
        </div>
        <p className="m-0 rounded-xl bg-white p-4 text-sm shadow-sm">🔒 <strong>Vie privée :</strong> aucune publicité, aucun suivi, aucun service extérieur. Les vidéos et les données des jeunes ne sont visibles que de leur famille et de leur coach, et sont supprimées sur demande ou après 12 mois.</p>
      </div>
    </section>
  );
}

// Champ mot de passe avec bouton « afficher / masquer » (utile sur téléphone)
export function PasswordInput({ id, name, autoComplete, minLength, required = true }: { id: string; name: string; autoComplete: string; minLength?: number; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} required={required} minLength={minLength} maxLength={128} autoComplete={autoComplete} className="input !pr-24" />
      <button type="button" onClick={() => setShow(!show)} aria-pressed={show} className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-lg px-3 text-sm font-bold text-clay hover:bg-sand">{show ? "Masquer" : "Afficher"}</button>
    </div>
  );
}
