// Listes fixes des partenaires du club (la même liste existe côté site : apps/web/src/sponsors.ts)
export const STATUSES = ["A_CONTACTER", "RELANCE", "SIGNE", "FACTURE", "PAYE", "TERMINE"] as const;
export const PERKS = ["AFFICHE_MOIS", "AFFICHE_EVENT", "BACHE", "STAGES", "TOURNOI", "SITE", "SOIREE"] as const;
export const MAX_SPONSORS = 40;
export const MAX_LOGO = 90_000; // caractères (≈ 65 Ko d'image) : reste sous la limite de 100 Ko d'une demande JSON
export const MAX_PACKS = 4;
export const MAX_FACTS = 6;
