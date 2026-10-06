import { Role } from "@prisma/client";

export interface AuthUser { id: string; role: Role; email: string; }
export const COOKIE_ACCESS = "cc_at";
export const COOKIE_REFRESH = "cc_rt";

// Coach ou entraîneur de comité : les deux saisissent le suivi ; l'entraîneur ne le fait que pour les jeunes qui lui sont confiés.
export const isStaff = (u: { role: Role }) => u.role === Role.COACH || u.role === Role.TRAINER;
