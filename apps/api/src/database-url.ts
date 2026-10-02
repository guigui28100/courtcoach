// Vercel + Neon donnent l'adresse de la base sous plusieurs noms selon la façon dont on la relie au projet
// (avec ou sans préfixe, par exemple « STORAGE_DATABASE_URL »). On accepte les cas courants pour que le débutant n'ait rien à recopier.
type Env = Record<string, string | undefined>;

// Cherche d'abord le nom exact, puis le même nom précédé d'un préfixe (XXX_DATABASE_URL).
function pick(env: Env, names: string[]): string | undefined {
  for (const n of names) if (env[n]) return env[n];
  for (const n of names) {
    const key = Object.keys(env).find((k) => k.endsWith("_" + n) && env[k]);
    if (key) return env[key];
  }
  return undefined;
}

export function resolveDatabaseUrl(env: Env = process.env): string | undefined {
  const url = pick(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "NEON_DATABASE_URL"]);
  if (!url) return undefined;
  // Adresse « poolée » de Neon : Prisma a besoin de ce réglage pour bien fonctionner derrière le répartiteur de connexions.
  if (/-pooler\./.test(url) && !/pgbouncer=/.test(url)) return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true&connect_timeout=15";
  return url;
}

// Adresse « directe » (sans répartiteur), à utiliser pour créer les tables au déploiement.
export function resolveMigrationUrl(env: Env = process.env): string | undefined {
  return pick(env, ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) || pick(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "NEON_DATABASE_URL"]);
}
