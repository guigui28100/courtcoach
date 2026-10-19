-- Créneau pris « à l'année » : les cours d'une même série partagent un identifiant
ALTER TABLE "LessonRequest" ADD COLUMN "seriesId" TEXT;
CREATE INDEX "LessonRequest_seriesId_idx" ON "LessonRequest"("seriesId");
