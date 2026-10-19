-- AlterTable
ALTER TABLE "LessonRequest" ADD COLUMN     "slotKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LessonRequest_profId_slotKey_key" ON "LessonRequest"("profId", "slotKey");

