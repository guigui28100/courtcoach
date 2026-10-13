import { Role } from "@prisma/client";
import { createHash } from "crypto";

export interface AuthUser { id: string; role: Role; email: string; }
export const COOKIE_ACCESS = "cc_at";
export const COOKIE_REFRESH = "cc_rt";

// Coach ou entraîneur de comité : les deux saisissent le suivi ; l'entraîneur ne le fait que pour les jeunes qui lui sont confiés.
export const isStaff = (u: { role: Role }) => u.role === Role.COACH || u.role === Role.TRAINER;

// Empreinte (non réversible) du mot de passe, glissée dans le jeton de connexion : un changement de mot de passe ferme aussitôt les anciennes sessions
export const passwordStamp = (passwordHash: string) => createHash("sha256").update("pv:" + passwordHash).digest("base64url").slice(0, 16);
