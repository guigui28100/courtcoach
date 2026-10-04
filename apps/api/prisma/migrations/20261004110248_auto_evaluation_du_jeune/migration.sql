-- CreateTable
CREATE TABLE "SelfEvaluation" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "trimester" INTEGER NOT NULL,
    "mood" INTEGER,
    "ratings" JSONB NOT NULL DEFAULT '{}',
    "goals" JSONB NOT NULL DEFAULT '{}',
    "proud" TEXT[],
    "improve" TEXT[],
    "wish" TEXT[],
    "comment" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SelfEvaluation_playerId_season_trimester_key" ON "SelfEvaluation"("playerId", "season", "trimester");

-- AddForeignKey
ALTER TABLE "SelfEvaluation" ADD CONSTRAINT "SelfEvaluation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
