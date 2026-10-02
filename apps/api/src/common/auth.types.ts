import { Role } from "@prisma/client";

export interface AuthUser { id: string; role: Role; email: string; }
export const COOKIE_ACCESS = "cc_at";
export const COOKIE_REFRESH = "cc_rt";
