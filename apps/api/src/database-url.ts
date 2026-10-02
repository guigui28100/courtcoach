// Vercel + Neon donnent l'adresse de la base sous plusieurs noms selon la façon dont on la relie au projet.
// On accepte les plus courants pour que le débutant n'ait rien à recopier à la main.
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const url = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || env.NEON_DATABASE_URL;
  if (!url) return undefined;
  // Adresse « poolée » de Neon : Prisma a besoin de ce réglage pour bien fonctionner derrière le répartiteur de connexions.
  if (/-pooler\./.test(url) && !/pgbouncer=/.test(url)) return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true&connect_timeout=15";
  return url;
}

// Adresse « directe » (sans répartiteur), à utiliser pour créer les tables au déploiement.
export function resolveMigrationUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || env.NEON_DATABASE_URL;
}
