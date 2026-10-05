-- CreateTable
CREATE TABLE "DeclaredMatch" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL,
    "score" TEXT NOT NULL DEFAULT '',
    "opponent" TEXT NOT NULL,
    "feeling" INTEGER NOT NULL,
    "wellDone" TEXT[],
    "toImprove" TEXT,
    "coachComment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeclaredMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeclaredMatch_playerId_day_idx" ON "DeclaredMatch"("playerId", "day");

-- AddForeignKey
ALTER TABLE "DeclaredMatch" ADD CONSTRAINT "DeclaredMatch_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
