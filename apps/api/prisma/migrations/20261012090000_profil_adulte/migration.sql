-- Profil de l'adulte (demandes de coaching) : nom, année de naissance, classement ou niveau
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthYear" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "level" TEXT;
