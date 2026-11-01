-- Affiches de résultats enregistrées en ligne (coach, président, bureau)
CREATE TABLE "PosterDraft" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosterDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PosterPhoto" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosterPhoto_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PosterPhoto" ADD CONSTRAINT "PosterPhoto_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PosterDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
