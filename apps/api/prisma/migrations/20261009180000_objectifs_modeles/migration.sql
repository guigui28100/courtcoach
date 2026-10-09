-- CreateTable
CREATE TABLE "GoalTemplate" (
    "id" TEXT NOT NULL,
    "axis" "Axis" NOT NULL,
    "title" TEXT NOT NULL,
    "indicator" TEXT NOT NULL DEFAULT '',
    "targetStars" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,

    CONSTRAINT "GoalTemplate_pkey" PRIMARY KEY ("id")
);
