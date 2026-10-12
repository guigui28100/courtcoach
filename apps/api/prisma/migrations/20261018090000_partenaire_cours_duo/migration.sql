-- Cours à deux : le partenaire de l'adulte (prénom, nom, âge, classement ou niveau)
ALTER TABLE "LessonRequest" ADD COLUMN "partnerFirstName" TEXT NOT NULL DEFAULT '', ADD COLUMN "partnerLastName" TEXT NOT NULL DEFAULT '', ADD COLUMN "partnerAge" INTEGER, ADD COLUMN "partnerLevel" TEXT NOT NULL DEFAULT '';
