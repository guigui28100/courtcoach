// Tarif d'une séance de cours particulier (en euros) : fixé par le club.
export const PRICE_MEMBER = 40; // adhérent du TC Houdan
export const PRICE_OTHER = 50; // autre personne
export const SUNDAY_EXTRA = 10; // supplément du dimanche (adhérent ou non)
const isSunday = (date?: string) => !!date && new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
export const lessonPrice = (clubMember: boolean, date?: string) => (clubMember ? PRICE_MEMBER : PRICE_OTHER) + (isSunday(date) ? SUNDAY_EXTRA : 0);
