-- Le professeur choisit s'il donne des cours pendant les vacances scolaires et les jours fériés (par défaut : non)
ALTER TABLE "ProfProfile" ADD COLUMN "skipHolidays" BOOLEAN NOT NULL DEFAULT true;
