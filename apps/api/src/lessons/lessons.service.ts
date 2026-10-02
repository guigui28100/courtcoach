import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LessonStatus, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/auth.types";
import { AnswerLessonDto, CreateLessonDto } from "./lessons.dto";

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
      return this.prisma.lessonRequest.findMany({ orderBy: { createdAt: "desc" }, include: { member: { select: { id: true, firstName: true, email: true } } } });
    }
    return this.prisma.lessonRequest.findMany({ where: { memberId: user.id }, orderBy: { createdAt: "desc" } });
  }

  async answer(user: AuthUser, id: string, dto: AnswerLessonDto) {
    if (user.role !== Role.COACH) throw new ForbiddenException("Réservé au coach");
    const r = await this.prisma.lessonRequest.updateMany({ where: { id, status: LessonStatus.PENDING }, data: { status: dto.status, coachReply: dto.reply ?? "", answeredAt: new Date(), seenByMemberAt: null } });
    if (!r.count) throw new NotFoundException("Demande introuvable ou déjà traitée");
    return this.prisma.lessonRequest.findUnique({ where: { id } });
  }

  async markSeen(user: AuthUser, id: string) {
    const r = await this.prisma.lessonRequest.updateMany({ where: { id, memberId: user.id, status: { not: LessonStatus.PENDING }, seenByMemberAt: null }, data: { seenByMemberAt: new Date() } });
    if (!r.count) throw new NotFoundException("Demande introuvable");
  }
}
