DROP INDEX "CourseStar_playerId_day_key";
CREATE INDEX "CourseStar_playerId_day_idx" ON "CourseStar"("playerId", "day");
