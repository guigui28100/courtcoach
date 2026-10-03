-- CreateTable
CREATE TABLE "VideoImage" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoImage_videoId_idx" ON "VideoImage"("videoId");

-- AddForeignKey
ALTER TABLE "VideoImage" ADD CONSTRAINT "VideoImage_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
