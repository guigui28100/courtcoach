-- Matchs déclarés par le jeune : auto-évaluation rapide sur ses missions
ALTER TABLE "DeclaredMatch" ADD COLUMN "missionChecks" JSONB NOT NULL DEFAULT '{}';
