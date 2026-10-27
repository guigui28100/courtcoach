import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";
import { CourtLines } from "../components/CourtLines";

// Terrain de tennis dessiné en SVG aux vraies proportions (aucune image extérieure)
const Court = () => (
  <svg viewBox="0 0 260 130" className="w-full max-w-md text-champagne" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    <CourtLines cx={130} y={14} h={104} netWidth={2.4} />
  </svg>
);

const PANELS = [
  { n: "I", title: "Adultes", text: "Envoie tes vidéos, reçois des conseils personnalisés et réserve un cours particulier quand tu veux, auprès du professeur de ton choix." },
  { n: "II", title: "Jeunes du Centre de compétition", text: "Un suivi complet : objectifs de l'année, évaluations, étoiles de fin de cours et bulletins. Les familles consultent leur espace en toute confiance." },
  { n: "III", title: "Coach et club", text: "Analyse des vidéos, dossiers des joueurs, planning de la saison, affiches et partenaires : toute la vie du club au même endroit." },
];
const STEPS = [["01", "Je filme", "Quelques coups, depuis mon téléphone."], ["02", "J'envoie", "En quelques clics, en toute sécurité."], ["03", "Je reçois l'analyse", "Images annotées et conseils du coach."], ["04", "Je progresse", "Objectifs, bulletins et suivi tout au long de l'année."]];

export default function Home() {
  const { me } = useAuth();
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-chalk" style={{ background: "radial-gradient(900px 420px at 85% 0%, rgba(201,173,119,0.22), transparent 62%), linear-gradient(135deg, #17140f 0%, #241f16 100%)" }}>
        <div className="mx-auto grid max-w-[2400px] items-center gap-10 px-4 lg:px-10 2xl:px-14 py-16 sm:py-24 md:grid-cols-[1.35fr_1fr]">
          <div>
            <p className="eyebrow mb-5 !text-champagne">Tennis Club Houdan</p>
            <h1 className="mb-6 max-w-3xl !text-chalk" style={{ fontSize: "clamp(2.6rem, 5.4vw, 4.4rem)" }}>Cours, vidéos, suivi et vie du club : <em className="font-medium italic text-champagne">tout au même endroit.</em></h1>
            <hr className="rule-gold mb-6 w-32" />
            <p className="mb-9 max-w-xl text-lg text-chalk/80">Envoie une vidéo, reçois des conseils personnalisés et réserve un cours. Pour les jeunes compétiteurs : objectifs de l'année, évaluations et bulletins trimestriels.</p>
            <div className="flex flex-wrap gap-3">
              {me ? (
                <Link to={homeFor(me.role)} className="btn-clay no-underline">Ouvrir mon espace</Link>
              ) : (
                <>
                  <Link to="/connexion?mode=inscription" className="btn-clay no-underline">Créer mon compte</Link>
                  <Link to="/connexion" className="btn border border-champagne/70 text-chalk no-underline hover:bg-champagne hover:text-ink">Se connecter</Link>
                </>
              )}
            </div>
          </div>
          <div className="justify-self-center max-md:hidden"><Court /></div>
        </div>
      </section>

      <section className="mx-auto max-w-[2400px] px-4 lg:px-10 2xl:px-14 pt-16" aria-label="Pour qui">
        <p className="eyebrow mb-2">Pour qui</p>
        <h2 className="mb-10 max-w-2xl">Un même lieu, trois façons d'en profiter.</h2>
        <div className="grid divide-line md:grid-cols-3 md:divide-x">
          {PANELS.map((c) => (
            <article key={c.title} className="grid content-start gap-3 py-6 md:px-8 md:first:pl-0 md:last:pr-0">
              <span className="font-serif text-5xl font-medium leading-none text-champagne-deep" aria-hidden="true">{c.n}</span>
              <h3 className="m-0">{c.title}</h3>
              <p className="m-0 text-muted">{c.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[2400px] px-4 lg:px-10 2xl:px-14 py-16" aria-labelledby="home-steps">
        <p className="eyebrow mb-2">En quatre temps</p>
        <h2 id="home-steps" className="mb-8">Comment ça marche</h2>
        <ol className="m-0 grid list-none gap-0 border-y border-line p-0 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="grid gap-1 px-1 py-6 lg:px-6 lg:first:pl-0">
              <span className="font-serif text-3xl font-semibold text-champagne-deep" style={{ fontFeatureSettings: '"lnum"' }} aria-hidden="true">{n}</span>
              <strong className="font-serif text-xl font-semibold">{t}</strong>
              <span className="text-sm text-muted">{d}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-champagne-deep pl-4 text-sm text-muted">Données protégées, aucun suivi publicitaire, jeunes cloisonnés des adultes. <Link to="/confidentialite" className="font-semibold text-ink underline decoration-champagne underline-offset-4">En savoir plus</Link></p>
      </section>
    </>
  );
}
