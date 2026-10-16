import { useState } from "react";
import { BackLink, CoachHero, Page } from "../components/ui";
import { ReportForm, ReportItem } from "../components/TournamentReports";
import { currentSeason, Goal, TournamentReport } from "../types";

// « 👀 Voir comme un entraîneur de comité » (coach seulement) : exemples INVENTÉS, aucun vrai jeune n'est lu, rien n'est envoyé ni enregistré.
const SEASON = currentSeason();
const goal = (id: string, title: string, axis: string) => ({ id, playerId: "demo", season: SEASON, title, axis, targetStars: 10, trimesters: [1, 2, 3], progress: 0, checkpoints: [], status: "TO_WORK" }) as unknown as Goal;
const GOALS: Goal[] = [goal("g1", "Service : lancer de balle", "TECHNIQUE"), goal("g2", "Jeu au filet : monter après le service", "TACTIQUE"), goal("g3", "Combativité : ne rien lâcher", "MENTAL")];
const day = new Date().toISOString().slice(0, 10);
const EXAMPLE: TournamentReport = {
  id: "demo-r", playerId: "demo", name: "Tournoi jeunes de Dreux (exemple)", dateFrom: day, dateTo: day, feeling: 3,
  matches: [{ day, round: "Finale", result: "Victoire", score: "6-4 3-6 7-5", opponentRanking: "30/2" }, { day, round: "", result: "Défaite", score: "4-6 2-6", opponentRanking: "30/1" }],
  themes: { service: { level: "tres-bien" }, "coup-droit": { level: "bien" }, combativite: { level: "tres-bien" }, retour: { level: "a-travailler" } },
  summary: "Beau tournoi ! Service et combativité au top. On travaille le retour.", status: "SUBMITTED", createdAt: new Date().toISOString(), authorName: "Entraîneur", authorRole: "TRAINER",
};
const CAN = ["Voir SEULEMENT les jeunes que tu lui confies (fiche sans la santé ni tes notes privées)", "Fixer des objectifs et des missions, évaluer les missions", "Faire le bilan de départ et les évaluations trimestrielles, écrire le bulletin", "Donner des étoiles (fin de cours)", "Saisir des matchs et commenter les matchs déclarés par le jeune", "🏆 Faire le bilan d'un tournoi (matchs, thèmes, mot) : il part chez toi pour validation", "Analyser les vidéos de SES jeunes, déposer des tournois, activer la double authentification"];
const CANNOT = ["Voir un jeune qui ne lui est pas confié (il « n'existe pas » pour lui)", "La santé et tes notes privées", "Valider un bilan de tournoi : seul toi, tu le valides (donc rien n'est visible de la famille ni d'étoile donnée avant)", "Supprimer un bilan déjà validé, ou le bilan d'un autre entraîneur", "Créer, supprimer ou exporter une fiche, gérer les accords, les comptes des familles et les autres entraîneurs", "Envoyer les e-mails « Prévenir la famille » (c'est toi qui préviens)", "Voir les demandes de coaching des adultes, remettre les étoiles à zéro, gérer le stockage des vidéos"];

export default function TrainerPreview() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CoachHero tone="jeunes" eyebrow="Aperçu · espace entraîneur de comité" title="👀 Voir comme un entraîneur de comité" subtitle="Exemples inventés : aucun vrai jeune n'est lu, rien n'est enregistré ni envoyé." actions={<BackLink fallback="/coach/centre?onglet=entraineurs" className="btn border-2 border-white/70 text-white no-underline hover:bg-white hover:text-ink">← Retour</BackLink>} />
      <Page>
        <p className="alert m-0"><strong>Aperçu.</strong> Voici ce que voit et ce que peut faire l'entraîneur de comité que tu crées dans l'onglet « 👥 Entraîneurs ». Les jeunes ci-dessous sont fictifs.</p>
        <section className="card grid gap-3" aria-labelledby="tp-jeunes">
          <h2 id="tp-jeunes" className="m-0 text-xl">🏆 Ses jeunes (ceux que tu coches pour lui)</h2>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
            <li className="rounded-2xl border-2 border-line p-3"><strong>Léo Exemple</strong><br /><small className="hint">confié ✅</small></li>
            <li className="rounded-2xl border-2 border-line p-3"><strong>Hugo Exemple</strong><br /><small className="hint">confié ✅</small></li>
            <li className="rounded-2xl border-2 border-dashed border-line p-3 opacity-60"><strong>Nina Exemple</strong><br /><small className="hint">non confiée : invisible pour lui ⛔</small></li>
          </ul>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card grid gap-2" aria-labelledby="tp-ok" style={{ borderLeft: "8px solid #2f8f5b" }}><h2 id="tp-ok" className="m-0 text-xl">✅ Ce qu'il peut faire</h2><ul className="m-0 grid gap-1 pl-5">{CAN.map((x) => <li key={x}>{x}</li>)}</ul></section>
          <section className="card grid gap-2" aria-labelledby="tp-ko" style={{ borderLeft: "8px solid #b3261e" }}><h2 id="tp-ko" className="m-0 text-xl">⛔ Ce qu'il ne peut pas faire</h2><ul className="m-0 grid gap-1 pl-5">{CANNOT.map((x) => <li key={x}>{x}</li>)}</ul></section>
        </div>
        <section className="grid gap-3" aria-labelledby="tp-bilan">
          <h2 id="tp-bilan" className="m-0 text-xl">🏆 Son bilan de tournoi (essai)</h2>
          <p className="hint m-0">C'est le vrai formulaire, avec des missions inventées pour Léo. Remplis-le pour essayer : rien n'est enregistré.</p>
          {open ? <ReportForm preview p={{ id: "demo", firstName: "Léo" }} goals={GOALS} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} /> : <button className="btn-clay justify-self-start" onClick={() => setOpen(true)}>Faire le bilan d'un tournoi</button>}
          <h3 className="m-0 text-lg">Un bilan déjà envoyé par l'entraîneur (exemple)</h3>
          <ReportItem r={EXAMPLE} p={{ id: "demo", firstName: "Léo" }} preview asRole="TRAINER" onChanged={() => undefined} />
        </section>
      </Page>
    </>
  );
}
