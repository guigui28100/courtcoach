-- CreateTable
CREATE TABLE "CourseStar" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseStar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseStar_playerId_day_key" ON "CourseStar"("playerId", "day");

-- AddForeignKey
ALTER TABLE "CourseStar" ADD CONSTRAINT "CourseStar_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
