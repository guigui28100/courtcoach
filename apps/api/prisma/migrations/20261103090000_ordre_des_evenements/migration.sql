-- Planning du club : ordre des événements dans une case du calendrier (glisser-déposer)
ALTER TABLE "ClubEvent" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
