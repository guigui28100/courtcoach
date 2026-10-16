-- Bilan de tournoi (entraîneur de comité → validation par le coach) ; matchs et étoiles « en match » créés à la validation
CREATE TABLE "TournamentReport" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateFrom" TEXT NOT NULL,
    "dateTo" TEXT NOT NULL,
    "feeling" INTEGER NOT NULL,
    "matches" JSONB NOT NULL DEFAULT '[]',
    "themes" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "authorRole" TEXT,
    CONSTRAINT "TournamentReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TournamentReport_playerId_dateTo_idx" ON "TournamentReport"("playerId", "dateTo");
CREATE INDEX "TournamentReport_status_idx" ON "TournamentReport"("status");
ALTER TABLE "TournamentReport" ADD CONSTRAINT "TournamentReport_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD COLUMN "reportId" TEXT;
CREATE INDEX "Match_reportId_idx" ON "Match"("reportId");
ALTER TABLE "CourseStar" ADD COLUMN "reportId" TEXT;
CREATE INDEX "CourseStar_reportId_idx" ON "CourseStar"("reportId");
