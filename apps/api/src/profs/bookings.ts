import { LessonStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { nowParis, toMin } from "./planning";

// Sans réponse du professeur sous 48 h, une réservation est annulée et le créneau est libéré (l'adulte le voit dans « Mes cours »).
export const CONFIRM_HOURS = 48;

export async function expireStaleBookings(prisma: PrismaService) {
  const limit = new Date(Date.now() - CONFIRM_HOURS * 3_600_000);
  const NO_REPLY = "Le professeur n'a pas répondu à temps : le créneau a été libéré. Tu peux en choisir un autre.";
  await prisma.lessonRequest.updateMany({
    where: { status: LessonStatus.BOOKED, createdAt: { lt: limit } },
    data: { status: LessonStatus.REFUSED, slotKey: null, coachReply: NO_REPLY, answeredAt: new Date(), seenByMemberAt: null },
  });
  // Un cours réservé que personne n'a confirmé et dont l'heure est PASSÉE ne doit plus rester « à confirmer » (le délai de 48 h peut dépasser l'heure du cours : on peut réserver à 24 h)
  const { date, minutes } = nowParis();
  const open = await prisma.lessonRequest.findMany({ where: { status: LessonStatus.BOOKED }, select: { id: true, finalSlot: true } });
  const late = open.filter((r) => { const f = r.finalSlot as { date?: string; time?: string } | null; return !!f?.date && (f.date < date || (f.date === date && !!f.time && toMin(f.time) <= minutes)); }).map((r) => r.id);
  if (late.length) await prisma.lessonRequest.updateMany({ where: { id: { in: late }, status: LessonStatus.BOOKED }, data: { status: LessonStatus.REFUSED, slotKey: null, coachReply: NO_REPLY, answeredAt: new Date(), seenByMemberAt: null } });
}

// Un professeur arrête les cours particuliers (ou son compte est supprimé) : tous ses cours À VENIR (réservés, proposés, confirmés, séries comprises) sont annulés, les créneaux sont libérés et les adultes sont prévenus dans « Mes cours ». Les cours passés restent. Les demandes sans date (« en attente ») reviennent au coach.
export async function releaseProfLessons(prisma: PrismaService, profId: string) {
  const today = nowParis().date;
  const rows = await prisma.lessonRequest.findMany({ where: { profId, status: { in: [LessonStatus.BOOKED, LessonStatus.PROPOSED, LessonStatus.ACCEPTED] } }, select: { id: true, finalSlot: true } });
  const ids = rows.filter((r) => { const f = r.finalSlot as { date?: string } | null; return !f?.date || f.date >= today; }).map((r) => r.id);
  if (ids.length) await prisma.lessonRequest.updateMany({ where: { id: { in: ids } }, data: { status: LessonStatus.REFUSED, slotKey: null, coachReply: "Le professeur a arrêté les cours particuliers : ce cours est annulé et le créneau est libéré. Tu peux choisir un autre professeur.", answeredAt: new Date(), seenByMemberAt: null } });
  await prisma.lessonRequest.updateMany({ where: { profId }, data: { profId: null } }); // les demandes en attente sans date reviennent au coach ; les cours annulés gardent leur message
  return ids.length;
}
