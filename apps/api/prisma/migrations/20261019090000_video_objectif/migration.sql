-- Vidéo rattachée à une ou plusieurs missions du joueur
CREATE TABLE "VideoGoal" (
    "videoId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    CONSTRAINT "VideoGoal_pkey" PRIMARY KEY ("videoId","goalId")
);
CREATE INDEX "VideoGoal_goalId_idx" ON "VideoGoal"("goalId");
ALTER TABLE "VideoGoal" ADD CONSTRAINT "VideoGoal_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoGoal" ADD CONSTRAINT "VideoGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Les missions déjà reliées par une analyse restent reliées à la vidéo
INSERT INTO "VideoGoal" ("videoId", "goalId") SELECT DISTINCT a."videoId", ag."goalId" FROM "AnalysisGoal" ag JOIN "Analysis" a ON a."id" = ag."analysisId" ON CONFLICT DO NOTHING;
