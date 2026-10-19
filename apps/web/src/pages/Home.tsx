import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";

// Terrain de tennis dessiné en SVG (aucune image extérieure)
const Court = () => (
  <svg viewBox="0 0 240 150" className="hero-court w-full max-w-sm" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
    <rect x="10" y="10" width="220" height="130" rx="6" /><path d="M120 10v130M10 75h220M45 28v94M195 28v94M45 75h150" strokeLinecap="round" />
    <circle cx="178" cy="42" r="11" fill="#dcf247" stroke="none" /><path d="M170 36c5 4 5 12 0 16M186 36c-5 4-5 12 0 16" stroke="#10203a" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CARDS = [
  { icon: "🎾", title: "Adultes", text: "Envoie tes vidéos, reçois des conseils et demande un cours particulier quand tu veux.", color: "#fdf1ea" },
  { icon: "🚀", title: "Jeunes du Centre de compétition", text: "Un suivi complet : objectifs de l'année (technique, tactique, physique, mental), évaluations et bulletins. Les familles consultent en lecture seule.", color: "#efe8fb" },
  { icon: "📋", title: "Coach", text: "Analyse les vidéos, suis l'évolution de chaque joueur et prépare les bulletins trimestriels.", color: "#e8edf6" },
];
const STEPS = [["1", "Je filme", "Quelques coups, depuis mon téléphone."], ["2", "Je l'envoie", "En quelques clics, en toute sécurité."], ["3", "Je reçois l'analyse", "Images annotées et conseils du coach."], ["4", "Je progresse", "Objectifs, bulletins et suivi dans l'année."]];

export default function Home() {
  const { me } = useAuth();
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-clay to-[#8f3516] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-14 sm:py-20 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/80">Tennis Club Houdan</p>
            <h1 className="mb-4 max-w-3xl !text-white">Ton coach analyse ton geste, tu progresses.</h1>
            <p className="mb-6 max-w-2xl text-lg text-white/90">Envoie une vidéo, reçois des conseils personnalisés et demande un cours. Pour les jeunes compétiteurs : objectifs de l'année, évaluations et bulletins trimestriels.</p>
            <div className="flex flex-wrap gap-3">
              {me ? (
                <Link to={homeFor(me.role)} className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">Ouvrir mon espace</Link>
              ) : (
                <>
                  <Link to="/connexion?mode=inscription" className="btn bg-ball text-ink no-underline hover:bg-[#c9e02f]">Créer mon compte</Link>
                  <Link to="/connexion" className="btn border-2 border-white text-white no-underline hover:bg-white hover:text-clay">Se connecter</Link>
                </>
              )}
            </div>
          </div>
          <div className="justify-self-center max-md:hidden"><Court /></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pt-10 md:grid-cols-3" aria-label="Pour qui">
        {CARDS.map((c) => (
          <article key={c.title} className="card lift grid content-start gap-2">
            <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: c.color }} aria-hidden="true">{c.icon}</span>
            <h3 className="m-0">{c.title}</h3><p className="m-0 text-muted">{c.text}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="home-steps">
        <h2 id="home-steps" className="mb-4">Comment ça marche</h2>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="flex items-start gap-3 rounded-2xl bg-sand/60 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display font-black text-ball" aria-hidden="true">{n}</span>
              <span><strong className="block">{t}</strong><span className="text-sm text-muted">{d}</span></span>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-4 text-sm text-muted"><span aria-hidden="true">🔒</span> Données protégées, aucun suivi publicitaire, jeunes cloisonnés des adultes. <Link to="/confidentialite" className="font-bold text-clay underline">En savoir plus</Link></p>
      </section>
    </>
  );
}
