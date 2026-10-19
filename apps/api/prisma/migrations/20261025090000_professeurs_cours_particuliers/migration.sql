-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clubMember" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LessonRequest" ADD COLUMN     "memberDeclared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" INTEGER,
ADD COLUMN     "profId" TEXT;

-- CreateTable
CREATE TABLE "ProfProfile" (
    "userId" TEXT NOT NULL,
    "birthYear" INTEGER,
    "showAge" BOOLEAN NOT NULL DEFAULT false,
    "ranking" TEXT,
    "bestRanking" TEXT,
    "bio" TEXT NOT NULL DEFAULT '',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER,
    "date" TEXT,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "ProfSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "validUntil" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfSlot_userId_idx" ON "ProfSlot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfDocument_userId_kind_key" ON "ProfDocument"("userId", "kind");

-- CreateIndex
CREATE INDEX "LessonRequest_profId_idx" ON "LessonRequest"("profId");

-- AddForeignKey
ALTER TABLE "ProfProfile" ADD CONSTRAINT "ProfProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfSlot" ADD CONSTRAINT "ProfSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ProfProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfDocument" ADD CONSTRAINT "ProfDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ProfProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

