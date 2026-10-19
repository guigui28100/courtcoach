import { PrismaService } from "../prisma/prisma.service";

// Mémoire de 3 secondes pour la vérification de connexion : une page qui lance 10 demandes d'un coup ne vérifie plus 10 fois la même personne en base.
// Tout changement qui doit couper un accès tout de suite (mot de passe, suppression de compte, double authentification) vide la mémoire (forgetUser).
// Sur un AUTRE serveur Vercel, la mémoire peut garder l'ancienne réponse jusqu'à 3 secondes au plus.
const TTL_MS = 3000;
const MAX = 500;
const row = { id: true, role: true, email: true, deletedAt: true, mustChangePassword: true, passwordHash: true, totpEnabled: true } as const;
export type CachedUser = { id: string; role: import("@prisma/client").Role; email: string; deletedAt: Date | null; mustChangePassword: boolean; passwordHash: string; totpEnabled: boolean };
const cache = new Map<string, { at: number; user: CachedUser }>();

export const forgetUser = (id: string) => { cache.delete(id); };
const enabled = () => process.env.NODE_ENV !== "test" || !!process.env.TEST_USER_CACHE; // les tests vérifient la base à chaque fois, sauf celui qui contrôle cette mémoire

export async function cachedUser(prisma: PrismaService, id: string): Promise<CachedUser | null> {
  const now = Date.now();
  const hit = enabled() ? cache.get(id) : undefined;
  if (hit && now - hit.at < TTL_MS) return hit.user;
  const user = await prisma.user.findUnique({ where: { id }, select: row });
  if (user && enabled()) { if (cache.size >= MAX) cache.clear(); cache.set(id, { at: now, user }); } else cache.delete(id);
  return user;
}
