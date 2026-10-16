// Thèmes proposés pour le bilan de tournoi (mêmes libellés que les « points à travailler » des missions : « Coup droit : … », « Retour de service : … »)
export const REPORT_THEMES: { key: string; label: string; axis: string }[] = [
  { key: "coup-droit", label: "Coup droit", axis: "technique" }, { key: "revers", label: "Revers", axis: "technique" }, { key: "service", label: "Service", axis: "technique" },
  { key: "retour", label: "Retour de service", axis: "technique" }, { key: "volee", label: "Volée", axis: "technique" }, { key: "smash", label: "Smash", axis: "technique" }, { key: "jeu-de-jambes", label: "Jeu de jambes", axis: "technique" },
  { key: "defendre", label: "Défendre", axis: "tactique" }, { key: "attaquer", label: "Attaquer", axis: "tactique" }, { key: "jeu-au-filet", label: "Jeu au filet", axis: "tactique" },
  { key: "construire", label: "Construire le point", axis: "tactique" }, { key: "variations", label: "Variations", axis: "tactique" }, { key: "lecture", label: "Lecture du jeu", axis: "tactique" },
  { key: "endurance", label: "Endurance", axis: "physique" }, { key: "vitesse", label: "Vitesse", axis: "physique" }, { key: "explosivite", label: "Explosivité", axis: "physique" },
  { key: "gainage", label: "Gainage", axis: "physique" }, { key: "coordination", label: "Coordination", axis: "physique" }, { key: "souplesse", label: "Souplesse", axis: "physique" },
  { key: "concentration", label: "Concentration", axis: "mental" }, { key: "emotions", label: "Gestion des émotions", axis: "mental" }, { key: "routines", label: "Routines", axis: "mental" },
  { key: "confiance", label: "Confiance", axis: "mental" }, { key: "combativite", label: "Combativité", axis: "mental" },
  { key: "ecoute", label: "Écoute", axis: "attitude" }, { key: "effort", label: "Effort", axis: "attitude" }, { key: "comportement", label: "Comportement", axis: "attitude" }, { key: "fair-play", label: "Fair-play", axis: "attitude" },
];
// Niveau donné à un thème → étoiles « en match » (déjà doublées : ×2). « À travailler » ne retire jamais d'étoile.
export const REPORT_LEVELS: Record<string, number> = { "a-travailler": 0, bien: 2, "tres-bien": 4 };
