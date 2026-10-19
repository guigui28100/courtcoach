// Tarif d'une séance de cours particulier (en euros) : fixé par le club.
export const PRICE_MEMBER = 40; // adhérent du TC Houdan
export const PRICE_OTHER = 50; // autre personne
export const lessonPrice = (clubMember: boolean) => (clubMember ? PRICE_MEMBER : PRICE_OTHER);
