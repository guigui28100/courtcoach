import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LessonStatus, Prisma, Role } from "@prisma/client";
import { coversSlot, overlaps } from "../profs/planning";
import { seriesDates } from "../profs/series";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser, isManager } from "../common/auth.types";
import { AnswerLessonDto, CancelLessonDto, CreateLessonDto, StopSeriesDto } from "./lessons.dto";
import { expireStaleBookings } from "../profs/bookings";
import { ProfsService } from "../profs/profs.service";
import { lessonPrice } from "../profs/pricing";

// Réservations à venir en même temps, par adulte (2 ; les tests des autres fonctions montent la limite par MAX_LESSONS_AHEAD)
export const maxAhead = () => Number(process.env.MAX_LESSONS_AHEAD) || 2;

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService, private readonly profs: ProfsService) {}

  async create(user: AuthUser, dto: CreateLessonDto) {
    if (user.role !== Role.ADULT) throw new ForbiddenException("Les demandes de cours sont réservées aux adhérents adultes");
    // Cours à deux : il faut savoir QUI vient (prénom, nom, âge, classement ou niveau du partenaire)
    const duo = dto.type === "duo";
    if (duo && (!dto.partnerFirstName?.trim() || !dto.partnerLastName?.trim() || !dto.partnerAge || !dto.partnerLevel)) throw new BadRequestException("Pour un cours à deux, indique le prénom, le nom, l'âge et le classement (ou le niveau) de ton partenaire.");
    const partner = duo ? { partnerFirstName: dto.partnerFirstName!.trim(), partnerLastName: dto.partnerLastName!.trim(), partnerAge: dto.partnerAge!, partnerLevel: dto.partnerLevel! } : {};
    // Professeur choisi : il doit être visible et accepter des demandes ; le tarif est figé maintenant (40 € adhérent TC Houdan, 50 € sinon)
    if (!dto.profId || !dto.slot) throw new BadRequestException("Choisis un professeur et un créneau libre dans son planning.");
    await this.profs.assertBookable(dto.profId);
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { clubMember: true } });
    const prof = { profId: dto.profId, price: lessonPrice(me.clubMember, dto.slot.date), memberDeclared: me.clubMember };
    // Réservation d'un créneau du planning : le créneau est mis de côté et le professeur doit confirmer (48 h) ; un seul cours par professeur et par créneau (garanti par la base)
    await this.profs.assertSlotFree(dto.profId, dto.slot);
    const mine = await this.prisma.lessonRequest.findMany({ where: { memberId: user.id, status: { in: [LessonStatus.BOOKED, LessonStatus.PROPOSED, LessonStatus.ACCEPTED] } }, select: { id: true, seriesId: true, finalSlot: true } });
    // Au plus 2 réservations à venir en même temps (une série « toute l'année » compte pour une seule) : évite qu'un adulte bloque beaucoup de créneaux
    const today = new Date().toISOString().slice(0, 10);
    const ahead = new Set(mine.filter((m) => ((m.finalSlot as { date?: string } | null)?.date ?? "") >= today).map((m) => m.seriesId ?? m.id));
    if (ahead.size >= maxAhead()) throw new ConflictException(`Tu as déjà ${maxAhead()} cours réservés à venir. Attends qu'un cours ait eu lieu, ou annules-en un, pour en réserver un autre.`);
    if (mine.some((m) => { const s = m.finalSlot as { date?: string; time?: string } | null; return s?.date === dto.slot!.date && !!s.time && overlaps(s.time, dto.slot!.time); })) throw new ConflictException("Tu as déjà un cours à ce moment-là.");
    const wd = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][(new Date(`${dto.slot.date}T12:00:00Z`).getUTCDay() + 6) % 7];
    const h = Number(dto.slot.time.slice(0, 2));
    const booked = { status: LessonStatus.BOOKED, finalSlot: { date: dto.slot.date, time: dto.slot.time }, slotKey: `${dto.slot.date}T${dto.slot.time}`, seenByMemberAt: new Date(), days: [wd], moment: h < 12 ? "Matin" : h < 18 ? "Après-midi" : "Soirée" };
    if (dto.weekly) return this.createSeries(user, dto, { ...partner, ...prof, ...booked });
    try {
      return await this.prisma.lessonRequest.create({ data: { memberId: user.id, type: dto.type, objective: dto.objective, message: dto.message ?? "", ...partner, ...prof, ...booked } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictException("Ce créneau vient d'être réservé par quelqu'un d'autre. Choisis-en un autre."); // deux clics en même temps
      throw e;
    }
  }

  // « Toute l'année » : le même créneau chaque semaine jusqu'au 30 juin. Vacances scolaires et jours fériés sont sautés, ainsi que les dates où le professeur n'est pas disponible ou déjà pris : on les renvoie pour les montrer.
  private async createSeries(user: AuthUser, dto: CreateLessonDto, common: object) {
    const slot = dto.slot!; const { slots, busy, skipHolidays } = await this.profs.availabilityOf(dto.profId!);
    const mine = await this.prisma.lessonRequest.findMany({ where: { memberId: user.id, status: { in: [LessonStatus.BOOKED, LessonStatus.PROPOSED, LessonStatus.ACCEPTED] } }, select: { finalSlot: true } });
    const wd = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][(new Date(`${slot.date}T12:00:00Z`).getUTCDay() + 6) % 7];
    const h = Number(slot.time.slice(0, 2)); const seriesId = randomUUID();
    const avail = slots.map((x) => ({ weekday: x.weekday, date: x.date, start: x.start, end: x.end }));
    const rows: string[] = []; const skipped: { date: string; why: string }[] = [];
    for (const d of seriesDates(slot.date, skipHolidays)) {
      if (d.skip && d.date !== slot.date) { skipped.push({ date: d.date, why: d.skip }); continue; }
      if (d.date !== slot.date && !coversSlot(avail, d.date, slot.time, skipHolidays)) { skipped.push({ date: d.date, why: "le professeur n'est pas disponible" }); continue; }
      if (d.date !== slot.date && busy.some((b) => b.date === d.date && overlaps(b.time, slot.time))) { skipped.push({ date: d.date, why: "créneau déjà pris" }); continue; }
      if (mine.some((m) => { const f = m.finalSlot as { date?: string; time?: string } | null; return f?.date === d.date && !!f.time && overlaps(f.time, slot.time); })) { skipped.push({ date: d.date, why: "tu as déjà un cours à ce moment-là" }); continue; }
      rows.push(d.date);
    }
    if (!rows.includes(slot.date)) throw new ConflictException("Le premier créneau n'est pas réservable (vacances, jour férié ou déjà pris). Choisis-en un autre.");
    try {
      const created = await this.prisma.$transaction(rows.map((date) => this.prisma.lessonRequest.create({ data: { memberId: user.id, type: dto.type, objective: dto.objective, moment: h < 12 ? "Matin" : h < 18 ? "Après-midi" : "Soirée", message: dto.message ?? "", ...common, status: LessonStatus.BOOKED, seriesId, finalSlot: { date, time: slot.time }, slotKey: `${date}T${slot.time}`, seenByMemberAt: new Date(), days: [wd] } })));
      return { ...created[0], seriesCount: created.length, skipped };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictException("Un de ces créneaux vient d'être réservé par quelqu'un d'autre. Recommence.");
      throw e;
    }
  }

  // Noms des professeurs pour l'affichage (prénom et nom seulement)
  private async withProf<T extends { profId: string | null }>(rows: T[]) {
    const ids = [...new Set(rows.map((r) => r.profId).filter((x): x is string => !!x))];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
    return rows.map((r) => ({ ...r, prof: users.find((u) => u.id === r.profId) ?? null }));
  }

  // Un adulte voit les siennes ; le coach voit toutes les demandes ; un professeur ne voit QUE celles qui lui sont adressées.
  async list(user: AuthUser) {
    await expireStaleBookings(this.prisma);
    if (isManager(user)) {
      return this.withProf(await this.prisma.lessonRequest.findMany({ orderBy: { createdAt: "desc" }, include: { member: { select: { id: true, firstName: true, lastName: true, birthYear: true, level: true, phone: true, email: true } } } }));
    }
    if (user.role === Role.TRAINER) {
      await this.profs.assertProf(user.id); // un entraîneur qui n'a pas choisi de donner des cours n'a aucun accès aux demandes
      return this.prisma.lessonRequest.findMany({ where: { profId: user.id }, orderBy: { createdAt: "desc" }, include: { member: { select: { id: true, firstName: true, lastName: true, birthYear: true, level: true, phone: true } } } });
    }
    return this.withProf(await this.prisma.lessonRequest.findMany({ where: { memberId: user.id }, orderBy: { createdAt: "desc" } }));
  }

  // Le coach (ou le professeur choisi, pour SES cours) refuse ou annule un cours : le créneau est libéré et l'adulte est prévenu. (Plus de « proposer une date » : l'adulte choisit lui-même son créneau dans le planning.)
  async answer(user: AuthUser, id: string, dto: AnswerLessonDto) {
    if (!isManager(user)) await this.profs.assertProf(user.id);
    const l = await this.prisma.lessonRequest.findUnique({ where: { id } });
    if (!l || l.status === LessonStatus.REFUSED || (!isManager(user) && l.profId !== user.id)) throw new NotFoundException("Demande introuvable ou déjà traitée");
    if (l.status === LessonStatus.BOOKED && l.seriesId) { // « Je ne peux pas » sur une série à confirmer : toute la série est refusée
      await this.prisma.lessonRequest.updateMany({ where: { seriesId: l.seriesId, status: LessonStatus.BOOKED }, data: { status: LessonStatus.REFUSED, slotKey: null, coachReply: dto.reply ?? "", answeredAt: new Date(), seenByMemberAt: null } });
      return this.prisma.lessonRequest.findUnique({ where: { id } });
    }
    await this.prisma.lessonRequest.update({ where: { id }, data: { slotKey: null, status: LessonStatus.REFUSED, coachReply: dto.reply ?? "", answeredAt: new Date(), seenByMemberAt: null, finalSlot: Prisma.JsonNull, place: "", confirmedAt: null, adultReply: "", declinedSlot: Prisma.JsonNull } });
    return this.prisma.lessonRequest.findUnique({ where: { id } });
  }

  // Le professeur (pour SES cours) ou le coach confirme un créneau réservé par l'adulte
  async confirm(user: AuthUser, id: string) {
    if (!isManager(user)) await this.profs.assertProf(user.id);
    await expireStaleBookings(this.prisma);
    const l = await this.prisma.lessonRequest.findFirst({ where: { id, status: LessonStatus.BOOKED, ...(!isManager(user) ? { profId: user.id } : {}) } });
    if (!l) throw new NotFoundException("Aucune réservation à confirmer pour cette demande");
    // une série se confirme d'un seul coup (tous les cours « réservés » de la série)
    await this.prisma.lessonRequest.updateMany({ where: l.seriesId ? { seriesId: l.seriesId, status: LessonStatus.BOOKED } : { id }, data: { status: LessonStatus.ACCEPTED, confirmedAt: new Date(), answeredAt: new Date(), seenByMemberAt: null } });
    return this.prisma.lessonRequest.findUnique({ where: { id } });
  }

  // Le professeur (pour SES cours) ou le coach arrête une série : tous les cours à venir sont annulés et leurs créneaux libérés (les cours passés restent)
  async stopSeries(user: AuthUser, id: string, dto: StopSeriesDto) {
    if (!isManager(user)) await this.profs.assertProf(user.id);
    const l = await this.prisma.lessonRequest.findFirst({ where: { id, seriesId: { not: null }, ...(!isManager(user) ? { profId: user.id } : {}) } });
    if (!l) throw new NotFoundException("Série introuvable");
    return { stopped: await this.endSeries(l.seriesId!, dto.reply || "Le professeur a arrêté cette série de cours : les créneaux sont libérés.", { onlyProf: !isManager(user) ? user.id : undefined }) };
  }

  // Annule tous les cours à venir d'une série (créneaux libérés, l'adulte est prévenu)
  private async endSeries(seriesId: string, reply: string, opts: { memberId?: string; onlyProf?: string } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await this.prisma.lessonRequest.findMany({ where: { seriesId, status: { not: LessonStatus.REFUSED }, ...(opts.memberId ? { memberId: opts.memberId } : {}), ...(opts.onlyProf ? { profId: opts.onlyProf } : {}) }, select: { id: true, finalSlot: true } });
    const ids = rows.filter((r) => { const f = r.finalSlot as { date?: string } | null; return !f?.date || f.date >= today; }).map((r) => r.id);
    if (ids.length) await this.prisma.lessonRequest.updateMany({ where: { id: { in: ids } }, data: { status: LessonStatus.REFUSED, slotKey: null, coachReply: reply, answeredAt: new Date(), seenByMemberAt: null } });
    return ids.length;
  }

  // L'adulte annule sa demande ou son cours (avant qu'il ait eu lieu) : le créneau redevient libre et le professeur voit « annulé »
  async cancel(user: AuthUser, id: string, dto: CancelLessonDto = {}) {
    if (user.role !== Role.ADULT) throw new ForbiddenException("Réservé à l'adhérent");
    const l = await this.prisma.lessonRequest.findFirst({ where: { id, memberId: user.id, status: { not: LessonStatus.REFUSED } } });
    if (!l) throw new NotFoundException("Demande introuvable");
    const slot = l.finalSlot as { date?: string } | null;
    if (slot?.date && slot.date < new Date().toISOString().slice(0, 10)) throw new BadRequestException("Ce cours a déjà eu lieu.");
    if (dto.series && l.seriesId) { await this.endSeries(l.seriesId, "Série annulée par l'adulte", { memberId: user.id }); return this.prisma.lessonRequest.findUnique({ where: { id } }); }
    await this.prisma.lessonRequest.update({ where: { id }, data: { status: LessonStatus.REFUSED, slotKey: null, coachReply: "Annulé par l'adulte", answeredAt: new Date(), seenByMemberAt: new Date() } });
    return this.prisma.lessonRequest.findUnique({ where: { id } });
  }

  async markSeen(user: AuthUser, id: string) {
    const r = await this.prisma.lessonRequest.updateMany({ where: { id, memberId: user.id, status: { not: LessonStatus.PENDING }, seenByMemberAt: null }, data: { seenByMemberAt: new Date() } });
    if (!r.count) throw new NotFoundException("Demande introuvable");
  }
}
