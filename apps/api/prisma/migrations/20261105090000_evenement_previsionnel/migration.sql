-- Planning du club : événement « prévisionnel » (pas encore validé)
ALTER TABLE "ClubEvent" ADD COLUMN "tentative" BOOLEAN NOT NULL DEFAULT false;
