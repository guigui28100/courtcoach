-- Planning du club : informations de l'affiche d'un événement (horaires, lieu, inscriptions, formules et prix)
ALTER TABLE "ClubEvent" ADD COLUMN "time" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClubEvent" ADD COLUMN "place" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClubEvent" ADD COLUMN "signup" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClubEvent" ADD COLUMN "formulas" JSONB NOT NULL DEFAULT '[]';
