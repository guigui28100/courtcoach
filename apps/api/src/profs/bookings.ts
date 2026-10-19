import { LessonStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Sans réponse du professeur sous 48 h, une réservation est annulée et le créneau est libéré (l'adulte le voit dans « Mes cours »).
export const CONFIRM_HOURS = 48;

export async function expireStaleBookings(prisma: PrismaService) {
  const limit = new Date(Date.now() - CONFIRM_HOURS * 3_600_000);
  await prisma.lessonRequest.updateMany({
    where: { status: LessonStatus.BOOKED, createdAt: { lt: limit } },
    data: { status: LessonStatus.REFUSED, slotKey: null, coachReply: "Le professeur n'a pas répondu à temps : le créneau a été libéré. Tu peux en choisir un autre.", answeredAt: new Date(), seenByMemberAt: null },
  });
}
