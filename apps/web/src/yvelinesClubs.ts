// Clubs de tennis des Yvelines (78) pour « Contre quel club ? » (planning du club).
// LISTE PARTIELLE, notée par NOM DE COMMUNE (les noms exacts des clubs ne sont pas vérifiés) : communes où un club de tennis est cité dans des annuaires publics (comité des Yvelines, Pass'Sport, HelloAsso, Assoce.fr).
// Le comité en compte plus de 150 : à compléter avec la liste officielle (yvelines.fft.fr). Un club absent s'écrit à la main ; ceux déjà notés dans le planning sont proposés aussi.
export const YVELINES_CLUBS: string[] = [
  "Andrésy", "Aubergenville", "Auffargis", "Bréval", "Buc", "Carrières-sous-Poissy", "Châteaufort", "Chatou", "Chevreuse", "Courgent",
  "Crespières", "Dampierre-en-Yvelines", "Élancourt", "Feucherolles", "Guyancourt", "Houilles", "La Celle-Saint-Cloud", "Le Mesnil-Saint-Denis",
  "Le Pecq", "Le Vésinet", "Les Clayes-sous-Bois", "Les Mureaux", "Louveciennes", "Maisons-Laffitte", "Maule", "Morainvilliers-Bures", "Plaisir",
  "Rambouillet", "Saint-Arnoult-en-Yvelines", "Saint-Cyr-l'École", "Saint-Germain-en-Laye", "Verneuil-sur-Seine", "Vernouillet",
].sort((a, b) => a.localeCompare(b, "fr"));
