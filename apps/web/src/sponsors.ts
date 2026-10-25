import { useEffect, useState } from "react";
import { get } from "./api";

// Partenaires (sponsors) du club : les mêmes listes existent côté serveur (apps/api/src/sponsors/sponsors.constants.ts)
export type PerkKey = "AFFICHE_MOIS" | "AFFICHE_EVENT" | "BACHE" | "STAGES" | "TOURNOI" | "SITE" | "SOIREE";
export const PERKS: { key: PerkKey; icon: string; label: string; hint: string }[] = [
  { key: "AFFICHE_MOIS", icon: "🗓️", label: "Logo sur l'affiche du mois", hint: "Votre logo en bas de l'affiche mensuelle du club, affichée au club et partagée avec les familles." },
  { key: "AFFICHE_EVENT", icon: "🪧", label: "Logo sur les affiches des événements", hint: "Votre logo sur les affiches des tournois, stages, animations et fêtes." },
  { key: "BACHE", icon: "🏟️", label: "Bâche ou panneau au bord d'un court", hint: "Un panneau à vos couleurs visible de tous les joueurs." },
  { key: "STAGES", icon: "🎾", label: "Mention sur les stages et les animations", hint: "Votre nom cité auprès des familles lors des stages et animations." },
  { key: "TOURNOI", icon: "🏆", label: "Nom associé à un tournoi", hint: "Un tournoi qui porte votre nom (« Tournoi » + votre entreprise)." },
  { key: "SITE", icon: "🌐", label: "Présence sur le site internet du club", hint: "Votre logo et un lien sur le site internet du club." },
  { key: "SOIREE", icon: "🥳", label: "Invitation à la fête du club", hint: "Vous êtes invités à la fête du club et aux temps forts de la saison." },
];
export const perkOf = (k: string) => PERKS.find((p) => p.key === k);

export type SponsorStatus = "A_CONTACTER" | "RELANCE" | "SIGNE" | "FACTURE" | "PAYE" | "TERMINE";
export const STATUSES: { key: SponsorStatus; label: string; color: string }[] = [
  { key: "A_CONTACTER", label: "À contacter", color: "#64748b" },
  { key: "RELANCE", label: "À relancer", color: "#c2410c" },
  { key: "SIGNE", label: "Contrat signé", color: "#1d4ed8" },
  { key: "FACTURE", label: "Facture envoyée", color: "#7c3aed" },
  { key: "PAYE", label: "Payé", color: "#15803d" },
  { key: "TERMINE", label: "Terminé", color: "#475569" },
];
export const statusOf = (k: string) => STATUSES.find((s) => s.key === k) ?? STATUSES[0];

export interface Sponsor {
  id: string; name: string; contactName: string; phone: string; email: string; amount: string; startDate: string; endDate: string;
  status: SponsorStatus; perks: string[]; pack: string; logo: string; note: string;
}
export interface Pack { name: string; price: string; perks: string[] }
export interface Offer { intro: string; facts: string[]; packs: Pack[] }

export const MAX_LOGO = 90_000;

// Le logo est réduit et gardé tel quel dans la base (PNG, ou JPEG si l'image est trop lourde) : rien ne passe par un service extérieur.
export async function logoFromFile(file: File): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error("Choisis une image PNG ou JPEG.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Image illisible.")); i.src = url; });
    for (const [w, mime, q] of [[360, "image/png", 0], [260, "image/png", 0], [360, "image/jpeg", 0.85], [260, "image/jpeg", 0.7], [180, "image/jpeg", 0.7]] as const) {
      const k = Math.min(1, w / img.width, (w * 0.6) / img.height);
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext("2d")!;
      if (mime === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL(mime, q || undefined);
      if (data.length <= MAX_LOGO - 2000) return data;
    }
    throw new Error("Ce logo est trop lourd : choisis une image plus simple.");
  } finally { URL.revokeObjectURL(url); }
}

// Logos à mettre sur les affiches : chaque partenaire apparaît là où sa contrepartie le prévoit (affiche du mois : « Logo sur l'affiche du mois » ; affiches d'événements : « Logo sur les affiches des événements »). Il faut un logo et un partenariat en cours (ni « à contacter » ni « terminé »).
// Seuls le coach et le président peuvent faire une affiche.
export function usePartnerLogos(where: "mois" | "event" = "event"): string[] {
  const [logos, setLogos] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    const perk = where === "mois" ? "AFFICHE_MOIS" : "AFFICHE_EVENT";
    get<{ sponsors: Sponsor[] }>("/sponsors").then((r) => { if (live) setLogos(r.sponsors.filter((s) => s.logo && s.perks.includes(perk) && s.status !== "TERMINE" && s.status !== "A_CONTACTER").map((s) => s.logo).slice(0, 8)); }).catch(() => {});
    return () => { live = false; };
  }, [where]);
  return logos;
}

// Jours avant la fin du contrat (négatif = déjà fini ; null = pas de date)
export function daysLeft(endDate: string, today: string): number | null {
  if (!endDate) return null;
  return Math.round((Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}
