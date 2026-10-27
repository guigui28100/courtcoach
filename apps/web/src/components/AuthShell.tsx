import { ReactNode, useState } from "react";
import { CourtLines } from "./CourtLines";
import { ClubLogo } from "./ui";

// Habillage des pages de connexion : un panneau « terrain de tennis » à gauche, le formulaire à droite (en haut sur téléphone).
export function AuthShell({ eyebrow, title, subtitle, children, tour }: { eyebrow?: string; title: string; subtitle?: ReactNode; children: ReactNode; tour?: boolean }) {
  return (
    <>
    <div className="grid lg:min-h-[calc(100dvh-125px)] lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative overflow-hidden px-6 py-10 text-chalk lg:px-14 lg:py-16" style={{ background: "radial-gradient(700px 420px at 100% 0%, rgba(201,173,119,0.22), transparent 62%), linear-gradient(160deg, #17140f 0%, #241f16 100%)" }} aria-label="Présentation">
        <svg viewBox="0 0 260 120" className="pointer-events-none absolute -bottom-6 -right-10 w-[24rem] text-champagne opacity-30 max-lg:hidden" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <CourtLines cx={130} y={6} h={108} netWidth={2.2} />
        </svg>
        <div className="relative grid max-w-md gap-5">
          <ClubLogo className="size-16 text-champagne" />
          <div>
            <p className="eyebrow m-0 !text-champagne">Tennis Club Houdan</p>
            <p className="m-0 mt-3 font-serif text-4xl font-medium leading-[1.05] lg:text-5xl">Cours, vidéos, suivi et vie du club : <em className="italic text-champagne">tout au même endroit.</em></p>
          </div>
          <hr className="rule-gold w-24" />
          <ul className="m-0 grid list-none gap-3 p-0 text-chalk/85 max-lg:hidden">
            {["Tes vidéos et les conseils de ton coach, au même endroit", "Objectifs et bulletins de l'année pour les jeunes du Centre", "Données protégées : aucune publicité, aucun suivi"].map((t) => (
              <li key={t} className="flex items-start gap-3"><span className="mt-2.5 h-px w-5 shrink-0 bg-champagne" aria-hidden="true" />{t}</li>
            ))}
          </ul>
          {tour && (
            <button type="button" onClick={() => document.getElementById("tour")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}
              className="mt-1 flex items-center justify-between gap-3 rounded-[3px] border border-champagne/70 px-4 py-3 text-left font-ui text-xs font-semibold uppercase tracking-[0.14em] text-champagne hover:bg-champagne hover:text-ink">
              <span>À quoi sert CourtCoach ? Découvre le site</span>
              <span aria-hidden="true" className="text-xl leading-none motion-safe:animate-bounce">⌄</span>
            </button>
          )}
        </div>
      </aside>

      <section className="grid content-center bg-chalk px-4 py-10 sm:px-8 lg:py-16">
        <div className="mx-auto grid w-full max-w-md gap-5">
          <header>
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            <h1 className="mb-2">{title}</h1>
            <hr className="rule-gold mb-3 w-20" />
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
    <section id="tour" className="scroll-mt-20 border-t border-line bg-paper px-4 py-14 sm:px-8 lg:px-12" aria-labelledby="tour-title">
      <div className="mx-auto grid max-w-[2400px] gap-8">
        <header className="max-w-2xl">
          <p className="eyebrow mb-2">À quoi sert CourtCoach ?</p>
          <h2 id="tour-title" className="m-0">Tout le suivi du Tennis Club Houdan, au même endroit</h2>
          <hr className="rule-gold my-4 w-24" />
          <p className="m-0 text-muted">Chacun voit seulement ce qui le concerne. Les jeunes, leurs parents et les professeurs entrent par invitation du coach ; les adultes peuvent créer leur compte.</p>
        </header>
        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {TOUR.map((c, k) => (
            <article key={c.title} className="grid content-start gap-2 border-t border-ink pt-4">
              <span className="font-serif text-3xl font-medium leading-none text-champagne-deep" style={{ fontFeatureSettings: '"lnum"' }} aria-hidden="true">{["I", "II", "III", "IV", "V"][k]}</span>
              <h3 className="m-0">{c.title}</h3>
              <p className="eyebrow m-0">{c.who}</p>
              <ul className="m-0 mt-1 grid list-none gap-2 p-0 text-sm">
                {c.items.map((t) => <li key={t} className="flex gap-3"><span className="mt-2 h-px w-3 shrink-0 bg-champagne-deep" aria-hidden="true" /><span>{t}</span></li>)}
              </ul>
            </article>
          ))}
        </div>
        <p className="m-0 border-l-2 border-champagne-deep pl-4 text-sm text-muted"><strong className="text-ink">Vie privée :</strong> aucune publicité, aucun suivi, aucun service extérieur. Les vidéos et les données des jeunes ne sont visibles que de leur famille et de leur coach, et sont supprimées sur demande ou après 12 mois.</p>
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
      <button type="button" onClick={() => setShow(!show)} aria-pressed={show} className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-[3px] px-3 font-ui text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-clay hover:bg-champagne-soft">{show ? "Masquer" : "Afficher"}</button>
    </div>
  );
}
