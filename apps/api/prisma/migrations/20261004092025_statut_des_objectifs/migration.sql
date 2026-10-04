-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACHIEVED', 'IN_PROGRESS', 'NOT_ACHIEVED');

-- AlterTable
ALTER TABLE "GoalCheckpoint" ADD COLUMN     "status" "GoalStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- Les points de contrôle déjà enregistrés : à 100 % = atteint, sinon en progrès (valeur par défaut)
UPDATE "GoalCheckpoint" SET "status" = 'ACHIEVED' WHERE "progress" >= 100;
