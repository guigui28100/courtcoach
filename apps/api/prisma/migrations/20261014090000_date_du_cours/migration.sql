-- Cours particuliers : date et heure précises fixées par le coach, et lieu
ALTER TABLE "LessonRequest" ADD COLUMN IF NOT EXISTS "finalSlot" JSONB;
ALTER TABLE "LessonRequest" ADD COLUMN IF NOT EXISTS "place" TEXT NOT NULL DEFAULT '';
