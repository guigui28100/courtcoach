-- Geste de départ / geste « maintenant » d'un joueur, marqués sur ses vidéos
ALTER TABLE "Video" ADD COLUMN "mark" TEXT, ADD COLUMN "markNote" TEXT, ADD COLUMN "markedAt" TIMESTAMP(3);
