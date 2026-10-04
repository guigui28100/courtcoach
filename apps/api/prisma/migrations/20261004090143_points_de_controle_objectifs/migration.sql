-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "trimesters" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "GoalCheckpoint" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "trimester" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoalCheckpoint_goalId_trimester_key" ON "GoalCheckpoint"("goalId", "trimester");

-- AddForeignKey
ALTER TABLE "GoalCheckpoint" ADD CONSTRAINT "GoalCheckpoint_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
