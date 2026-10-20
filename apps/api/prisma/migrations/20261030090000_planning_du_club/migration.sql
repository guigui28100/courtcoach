-- Planning prévisionnel du club : événements (tournois, animations, matchs par équipes, bulles, terre battue, stages) et réglages
CREATE TABLE "ClubEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "bands" TEXT[],
    "courts" INTEGER[],
    "teams" TEXT[],
    "who" TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubEvent_startDate_idx" ON "ClubEvent"("startDate");

CREATE TABLE "ClubSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "ClubSetting_pkey" PRIMARY KEY ("key")
);
