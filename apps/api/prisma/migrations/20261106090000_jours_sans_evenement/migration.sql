-- Planning du club : jours de la période où l'événement n'a pas lieu
ALTER TABLE "ClubEvent" ADD COLUMN "skipDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
