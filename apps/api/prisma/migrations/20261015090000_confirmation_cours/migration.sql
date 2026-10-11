-- Cours particuliers : l'adulte doit confirmer la date proposée par le coach
ALTER TYPE "LessonStatus" ADD VALUE IF NOT EXISTS 'PROPOSED';
ALTER TABLE "LessonRequest" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "LessonRequest" ADD COLUMN IF NOT EXISTS "adultReply" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LessonRequest" ADD COLUMN IF NOT EXISTS "declinedSlot" JSONB;
