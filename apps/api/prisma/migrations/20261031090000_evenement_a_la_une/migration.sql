-- Planning du club : case « ⭐ à mettre en avant sur l'affiche »
ALTER TABLE "ClubEvent" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
