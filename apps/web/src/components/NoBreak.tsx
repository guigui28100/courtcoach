import { Fragment, ReactNode } from "react";

// Adresse e-mail ou adresse de site internet : jamais coupée en deux lignes (affiches, dossier de saison).
const LINK = /^(?:https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:fr|com|org|net|eu|info|jimdofree\.com)\S*)$/i;

export function isLink(token: string) { return LINK.test(token.replace(/[.,;:)]+$/, "")); }

// Le texte le plus long d'une adresse (pour réduire la taille de la police si elle ne tient pas dans la place disponible)
export function longestLink(text: string) { return Math.max(0, ...text.split(/\s+/).filter(isLink).map((t) => t.length)); }

export function NoBreak({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\s+)/);
  return parts.map((t, i) => (isLink(t) ? <span key={i} style={{ whiteSpace: "nowrap" }}>{t}</span> : <Fragment key={i}>{t}</Fragment>));
}
