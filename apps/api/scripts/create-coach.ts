// Crée le compte du coach (jamais d'inscription libre pour un coach).
// Usage :  COACH_EMAIL=moi@exemple.fr COACH_PASSWORD='un-long-mot-de-passe' npm run create-coach
import { PrismaClient, Role } from "@prisma/client";
import { hash } from "@node-rs/argon2";

async function main() {
  const email = (process.env.COACH_EMAIL || "").trim().toLowerCase();
  const password = process.env.COACH_PASSWORD || "";
  if (!email.includes("@")) throw new Error("COACH_EMAIL manquant");
  if (password.length < 12) throw new Error("COACH_PASSWORD : 12 caractères minimum");
  const prisma = new PrismaClient();
  const passwordHash = await hash(password);
  await prisma.user.upsert({ where: { email }, update: { passwordHash, role: Role.COACH, deletedAt: null }, create: { email, passwordHash, role: Role.COACH, firstName: "Coach" } });
  await prisma.$disconnect();
  console.log("Compte coach prêt :", email);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
