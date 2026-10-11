-- Vidéo déposée par le coach pour un joueur : brouillon tant qu'elle n'est pas envoyée au joueur
ALTER TABLE "Video" ADD COLUMN "sentToPlayerAt" TIMESTAMP(3);
-- Les vidéos du coach déjà visibles par les joueurs restent visibles
UPDATE "Video" SET "sentToPlayerAt" = "recordedAt" WHERE "fromCoach" = true;
