/*
  Warnings:

  - You are about to drop the column `storageKey` on the `Video` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Video" DROP COLUMN "storageKey",
ADD COLUMN     "chunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'video/mp4';

-- CreateTable
CREATE TABLE "VideoChunk" (
    "videoId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "VideoChunk_pkey" PRIMARY KEY ("videoId","index")
);

-- CreateIndex
CREATE INDEX "Video_ownerId_idx" ON "Video"("ownerId");

-- CreateIndex
CREATE INDEX "Video_playerId_idx" ON "Video"("playerId");

-- AddForeignKey
ALTER TABLE "VideoChunk" ADD CONSTRAINT "VideoChunk_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
