// Construction sur Vercel : prépare le code, puis crée/met à jour les tables de la base.
const { execSync } = require("child_process");
const env = process.env;

// Même logique que src/database-url.ts : nom exact, sinon nom avec préfixe (ex. STORAGE_DATABASE_URL).
function pick(names) {
  for (const n of names) if (env[n]) return env[n];
  for (const n of names) { const key = Object.keys(env).find((k) => k.endsWith("_" + n) && env[k]); if (key) return env[key]; }
  return undefined;
}
const direct = pick(["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) || pick(["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "NEON_DATABASE_URL"]);
if (!direct) {
  console.error("\n❌ Aucune adresse de base de données trouvée. Relie la base au projet (Vercel → Storage → Connect Project) puis relance le déploiement.\n");
  process.exit(1);
}
const run = (cmd, extra = {}) => execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });
run("npx prisma generate", { DATABASE_URL: direct });
run("npx nest build");
run("npx prisma migrate deploy", { DATABASE_URL: direct });
