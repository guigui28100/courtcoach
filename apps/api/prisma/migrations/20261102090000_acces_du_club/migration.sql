-- Accès du club : président (gestion) et membres du bureau (lecture seule du planning)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRESIDENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUREAU';
-- Une invitation du club n'est pas liée à un joueur
ALTER TABLE "Invitation" ALTER COLUMN "playerId" DROP NOT NULL;
