// Construction sur Vercel : prépare le code, puis crée/met à jour les tables de la base.
const { execSync } = require("child_process");

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
if (!direct) {
  console.error("\n❌ Aucune adresse de base de données trouvée. Relie la base au projet (Vercel → Storage → Connect Project) puis relance le déploiement.\n");
  process.exit(1);
}
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
run("npx prisma generate", { DATABASE_URL: direct });
run("npx nest build");
run("npx prisma migrate deploy", { DATABASE_URL: direct });
