-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "targetStars" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "CourseStar" ADD COLUMN "goalId" TEXT;

-- CreateTable
CREATE TABLE "CourseQuality" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mindset" INTEGER,
    "motivation" INTEGER,
    "attendance" INTEGER,
    "attitude" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "authorName" TEXT,
    "authorRole" TEXT,

    CONSTRAINT "CourseQuality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseQuality_playerId_day_key" ON "CourseQuality"("playerId", "day");

-- AddForeignKey
ALTER TABLE "CourseStar" ADD CONSTRAINT "CourseStar_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseQuality" ADD CONSTRAINT "CourseQuality_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
