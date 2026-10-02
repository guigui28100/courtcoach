import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";

export default function Home() {
  const { me } = useAuth();
  return (
    <>
      <section className="bg-clay text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
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
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-3">
        {[
          ["Adultes", "Envoie tes vidéos, reçois des conseils et demande un cours particulier quand tu veux."],
          ["Jeunes du Centre de compétition", "Un suivi complet : objectifs de l'année (technique, tactique, physique, mental), évaluations et bulletins. Les familles consultent en lecture seule."],
          ["Coach", "Analyse les vidéos, suis l'évolution de chaque joueur et prépare les bulletins trimestriels."],
        ].map(([t, d]) => (
          <article key={t} className="card"><h3 className="mb-2">{t}</h3><p className="m-0 text-muted">{d}</p></article>
        ))}
      </section>
    </>
  );
}
