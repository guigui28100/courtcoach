import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LessonStatus, Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/auth.types";
import { AnswerLessonDto, CreateLessonDto, SlotDto } from "./lessons.dto";

// Une date réelle (pas le 31 février), aujourd'hui ou plus tard, dans les 18 mois
function checkSlot(s: SlotDto) {
  const d = new Date(`${s.date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s.date) throw new BadRequestException("Date invalide.");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (d.getTime() < today.getTime() - 86_400_000) throw new BadRequestException("Choisis une date à venir.");
  if (d.getTime() > today.getTime() + 548 * 86_400_000) throw new BadRequestException("Date trop lointaine.");
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: AuthUser, dto: CreateLessonDto) {
    if (user.role !== Role.ADULT) throw new ForbiddenException("Les demandes de cours sont réservées aux adhérents adultes");
    return this.prisma.lessonRequest.create({ data: { memberId: user.id, type: dto.type, objective: dto.objective, days: dto.days ?? [], moment: dto.moment ?? "Peu importe", message: dto.message ?? "" } });
  }

  // Un adulte voit les siennes ; le coach voit toutes les demandes (avec le prénom de la personne).
  async list(user: AuthUser) {
    if (user.role === Role.COACH) {
      return this.prisma.lessonRequest.findMany({ orderBy: { createdAt: "desc" }, include: { member: { select: { id: true, firstName: true, lastName: true, birthYear: true, level: true, phone: true, email: true } } } });
    }
    return this.prisma.lessonRequest.findMany({ where: { memberId: user.id }, orderBy: { createdAt: "desc" } });
  }

  // Le coach accepte en fixant une date et une heure précises (et le lieu), ou refuse
  async answer(user: AuthUser, id: string, dto: AnswerLessonDto) {
    if (user.role !== Role.COACH) throw new ForbiddenException("Réservé au coach");
    let finalSlot: Prisma.InputJsonValue | undefined;
    if (dto.status === LessonStatus.ACCEPTED) {
      if (!dto.slot) throw new BadRequestException("Indique la date et l'heure du cours.");
      checkSlot(dto.slot);
      finalSlot = { date: dto.slot.date, time: dto.slot.time };
    } else if (dto.slot) throw new BadRequestException("Un refus n'a pas de date.");
    const r = await this.prisma.lessonRequest.updateMany({ where: { id, status: LessonStatus.PENDING }, data: { status: dto.status, coachReply: dto.reply ?? "", answeredAt: new Date(), seenByMemberAt: null, finalSlot, place: dto.status === LessonStatus.ACCEPTED ? dto.place ?? "" : "" } });
    if (!r.count) throw new NotFoundException("Demande introuvable ou déjà traitée");
    return this.prisma.lessonRequest.findUnique({ where: { id } });
  }

  async markSeen(user: AuthUser, id: string) {
    const r = await this.prisma.lessonRequest.updateMany({ where: { id, memberId: user.id, status: { not: LessonStatus.PENDING }, seenByMemberAt: null }, data: { seenByMemberAt: new Date() } });
    if (!r.count) throw new NotFoundException("Demande introuvable");
  }
}
