import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LessonStatus, Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/auth.types";
import { AnswerLessonDto, CreateLessonDto, RespondLessonDto, SlotDto } from "./lessons.dto";
import { ProfsService } from "../profs/profs.service";
import { lessonPrice } from "../profs/pricing";

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
  constructor(private readonly prisma: PrismaService, private readonly profs: ProfsService) {}

  async create(user: AuthUser, dto: CreateLessonDto) {
    if (user.role !== Role.ADULT) throw new ForbiddenException("Les demandes de cours sont réservées aux adhérents adultes");
    // Cours à deux : il faut savoir QUI vient (prénom, nom, âge, classement ou niveau du partenaire)
    const duo = dto.type === "duo";
    if (duo && (!dto.partnerFirstName?.trim() || !dto.partnerLastName?.trim() || !dto.partnerAge || !dto.partnerLevel)) throw new BadRequestException("Pour un cours à deux, indique le prénom, le nom, l'âge et le classement (ou le niveau) de ton partenaire.");
    const partner = duo ? { partnerFirstName: dto.partnerFirstName!.trim(), partnerLastName: dto.partnerLastName!.trim(), partnerAge: dto.partnerAge!, partnerLevel: dto.partnerLevel! } : {};
    // Professeur choisi (facultatif) : il doit être visible et accepter des demandes ; le tarif est figé maintenant (40 € adhérent TC Houdan, 50 € sinon)
    let prof: { profId: string; price: number; memberDeclared: boolean } | object = {};
    if (dto.profId) {
      await this.profs.assertBookable(dto.profId);
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { clubMember: true } });
      prof = { profId: dto.profId, price: lessonPrice(me.clubMember), memberDeclared: me.clubMember };
    }
    return this.prisma.lessonRequest.create({ data: { memberId: user.id, type: dto.type, objective: dto.objective, days: dto.days ?? [], moment: dto.moment ?? "Peu importe", message: dto.message ?? "", ...partner, ...prof } });
  }

  // Noms des professeurs pour l'affichage (prénom et nom seulement)
  private async withProf<T extends { profId: string | null }>(rows: T[]) {
    const ids = [...new Set(rows.map((r) => r.profId).filter((x): x is string => !!x))];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
    return rows.map((r) => ({ ...r, prof: users.find((u) => u.id === r.profId) ?? null }));
  }

  // Un adulte voit les siennes ; le coach voit toutes les demandes ; un professeur ne voit QUE celles qui lui sont adressées.
  async list(user: AuthUser) {
    if (user.role === Role.COACH) {
      return this.withProf(await this.prisma.lessonRequest.findMany({ orderBy: { createdAt: "desc" }, include: { member: { select: { id: true, firstName: true, lastName: true, birthYear: true, level: true, phone: true, email: true } } } }));
    }
    if (user.role === Role.TRAINER) {
      await this.profs.assertProf(user.id); // un entraîneur qui n'a pas choisi de donner des cours n'a aucun accès aux demandes
      return this.prisma.lessonRequest.findMany({ where: { profId: user.id }, orderBy: { createdAt: "desc" }, include: { member: { select: { id: true, firstName: true, lastName: true, birthYear: true, level: true, phone: true } } } });
    }
    return this.withProf(await this.prisma.lessonRequest.findMany({ where: { memberId: user.id }, orderBy: { createdAt: "desc" } }));
  }

  // Le coach (ou le professeur choisi, pour SES demandes) propose une date et une heure précises (l'adulte doit la confirmer), ou refuse. Il peut aussi changer la date, ou annuler, tant que le cours n'a pas eu lieu.
  async answer(user: AuthUser, id: string, dto: AnswerLessonDto) {
    if (user.role !== Role.COACH) await this.profs.assertProf(user.id);
    const l = await this.prisma.lessonRequest.findUnique({ where: { id } });
    if (!l || l.status === LessonStatus.REFUSED || (user.role !== Role.COACH && l.profId !== user.id)) throw new NotFoundException("Demande introuvable ou déjà traitée");
    let finalSlot: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
    if (dto.status === LessonStatus.PROPOSED) {
      if (!dto.slot) throw new BadRequestException("Indique la date et l'heure du cours.");
      checkSlot(dto.slot);
      finalSlot = { date: dto.slot.date, time: dto.slot.time };
    } else if (dto.slot) throw new BadRequestException("Un refus n'a pas de date.");
    const proposing = dto.status === LessonStatus.PROPOSED;
    await this.prisma.lessonRequest.update({ where: { id }, data: { status: dto.status, coachReply: dto.reply ?? "", answeredAt: new Date(), seenByMemberAt: null, finalSlot: proposing ? finalSlot : Prisma.JsonNull, place: proposing ? dto.place ?? "" : "", confirmedAt: null, adultReply: "", declinedSlot: Prisma.JsonNull } });
    return this.prisma.lessonRequest.findUnique({ where: { id } });
  }

  // L'adulte confirme la date proposée, ou répond qu'il n'est pas disponible (la demande repart chez le coach)
  async respond(user: AuthUser, id: string, dto: RespondLessonDto) {
    if (user.role !== Role.ADULT) throw new ForbiddenException("Réservé à l'adhérent");
    const l = await this.prisma.lessonRequest.findFirst({ where: { id, memberId: user.id, status: LessonStatus.PROPOSED } });
    if (!l) throw new NotFoundException("Aucune date à confirmer pour cette demande");
    if (dto.action === "confirm") {
      await this.prisma.lessonRequest.update({ where: { id }, data: { status: LessonStatus.ACCEPTED, confirmedAt: new Date(), seenByMemberAt: new Date() } });
    } else {
      await this.prisma.lessonRequest.update({ where: { id }, data: { status: LessonStatus.PENDING, declinedSlot: (l.finalSlot ?? Prisma.JsonNull) as Prisma.InputJsonValue, adultReply: dto.message ?? "", finalSlot: Prisma.JsonNull, place: "", coachReply: "", answeredAt: null, seenByMemberAt: null } });
    }
    return this.prisma.lessonRequest.findUnique({ where: { id } });
  }

  async markSeen(user: AuthUser, id: string) {
    const r = await this.prisma.lessonRequest.updateMany({ where: { id, memberId: user.id, status: { not: LessonStatus.PENDING }, seenByMemberAt: null }, data: { seenByMemberAt: new Date() } });
    if (!r.count) throw new NotFoundException("Demande introuvable");
  }
}
