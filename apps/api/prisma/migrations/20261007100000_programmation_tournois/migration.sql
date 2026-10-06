-- CreateTable
CREATE TABLE "TournamentDoc" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "authorName" TEXT,
    "authorRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAfter" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentDocPlayer" (
    "docId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "TournamentDocPlayer_pkey" PRIMARY KEY ("docId","playerId")
);

-- AddForeignKey
ALTER TABLE "TournamentDocPlayer" ADD CONSTRAINT "TournamentDocPlayer_docId_fkey" FOREIGN KEY ("docId") REFERENCES "TournamentDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentDocPlayer" ADD CONSTRAINT "TournamentDocPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
