-- Type d'entraîneur : comité ou club (mêmes droits)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainerKind" TEXT;
