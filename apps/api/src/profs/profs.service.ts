import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser } from "../common/auth.types";
import { sniffDoc } from "../tournaments/tournaments.service";
import { DOC_KINDS, DocKind, ProfProfileDto, SlotDto } from "./profs.dto";
import { PRICE_MEMBER, PRICE_OTHER } from "./pricing";
import { expireStaleBookings, releaseProfLessons } from "./bookings";
import { buildPlanning, coversSlot, nowParis, overlaps, PlanDay } from "./planning";

const MAX_DOC_BYTES = 3 * 1024 * 1024;
const cleanName = (n: string) => n.replace(/[\\/\0-\x1f"]/g, "_").trim().slice(0, 120) || "document";
const todayIso = () => new Date().toISOString().slice(0, 10);

export type ProfStatus = "visible" | "paused" | "waiting" | "missing" | "expired";

// Professeurs de cours particuliers : un entraîneur (compte TRAINER créé par le coach) qui, dans son espace, clique « je souhaite donner des cours particuliers ».
// Un professeur n'est montré aux adultes que si les 3 documents sont déposés, la carte professionnelle est encore valable ET le coach a validé.
@Injectable()
export class ProfsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // Le compte doit être un entraîneur qui a choisi de donner des cours particuliers
  async assertProf(userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, role: Role.TRAINER, deletedAt: null, profProfile: { isNot: null } } });
    if (!u) throw new ForbiddenException("Réservé aux entraîneurs qui donnent des cours particuliers.");
    return u;
  }
  private async profile(userId: string) {
    return this.prisma.profProfile.upsert({ where: { userId }, update: {}, create: { userId }, include: { slots: true, documents: { select: { kind: true, fileName: true, mimeType: true, sizeBytes: true, validUntil: true, uploadedAt: true } } } });
  }

  private status(p: { approvedAt: Date | null; paused: boolean; documents: { kind: string; validUntil: Date | null }[] }): ProfStatus {
    const kinds = new Set(p.documents.map((d) => d.kind));
    if (!DOC_KINDS.every((k) => kinds.has(k))) return "missing";
    const card = p.documents.find((d) => d.kind === "CARTE_PRO");
    if (!card?.validUntil || card.validUntil.toISOString().slice(0, 10) < todayIso()) return "expired";
    if (!p.approvedAt) return "waiting";
    return p.paused ? "paused" : "visible";
  }

  private slotsOut(slots: { id: string; weekday: number | null; date: string | null; start: string; end: string }[]) {
    const t = todayIso();
    return slots.filter((s) => s.weekday !== null || (s.date !== null && s.date >= t))
      .sort((a, b) => (a.weekday ?? 9) - (b.weekday ?? 9) || (a.date ?? "").localeCompare(b.date ?? "") || a.start.localeCompare(b.start))
      .map((s) => ({ id: s.id, weekday: s.weekday, date: s.date, start: s.start, end: s.end }));
  }

  // ----- Ce que voit un adulte (ou le coach) : les professeurs visibles -----
  async listVisible(user: AuthUser) {
    const rows = await this.prisma.user.findMany({
      where: { role: Role.TRAINER, deletedAt: null, profProfile: { is: { approvedAt: { not: null } } } },
      include: { profProfile: { include: { slots: true, documents: { select: { kind: true, validUntil: true } } } } }, orderBy: { createdAt: "asc" },
    });
    const me = user.role === Role.ADULT ? await this.prisma.user.findUnique({ where: { id: user.id }, select: { clubMember: true } }) : null;
    const out = rows.flatMap((u) => {
      const p = u.profProfile!; const st = this.status(p);
      if (st !== "visible" && st !== "paused") return [];
      return [{
        id: u.id, firstName: u.firstName, lastName: u.lastName, age: p.showAge && p.birthYear ? new Date().getFullYear() - p.birthYear : null,
        ranking: p.ranking, bestRanking: p.bestRanking, bio: p.bio, paused: st === "paused", slots: this.slotsOut(p.slots),
      }];
    });
    return { profs: out, prices: { member: PRICE_MEMBER, other: PRICE_OTHER }, yourPrice: me ? (me.clubMember ? PRICE_MEMBER : PRICE_OTHER) : null };
  }

  // Une demande de cours ne peut viser qu'un professeur visible et qui accepte des demandes
  async assertBookable(profId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: profId, role: Role.TRAINER, deletedAt: null }, include: { profProfile: { include: { documents: { select: { kind: true, validUntil: true } } } } } });
    if (!u?.profProfile || this.status(u.profProfile) !== "visible") throw new BadRequestException("Ce professeur n'est pas disponible pour le moment.");
  }

  // Cours déjà placés chez ce professeur (réservés, proposés ou confirmés) : ils occupent son planning
  private async busyOf(profId: string, exceptLessonId?: string) {
    await expireStaleBookings(this.prisma); // un créneau réservé sans réponse du professeur depuis plus de 48 h est libéré
    const rows = await this.prisma.lessonRequest.findMany({ where: { profId, status: { in: ["PROPOSED", "BOOKED", "ACCEPTED"] }, ...(exceptLessonId ? { id: { not: exceptLessonId } } : {}) }, select: { finalSlot: true } });
    return rows.flatMap((r) => { const s = r.finalSlot as { date?: string; time?: string } | null; return s?.date && s?.time ? [{ date: s.date, time: s.time }] : []; });
  }

  // Disponibilités et cours déjà placés d'un professeur (pour réserver une série)
  async availabilityOf(profId: string) {
    await this.assertBookable(profId);
    const p = await this.prisma.profProfile.findUniqueOrThrow({ where: { userId: profId }, include: { slots: true } });
    return { slots: p.slots, busy: await this.busyOf(profId), skipHolidays: p.skipHolidays };
  }

  // Planning visible par l'adulte (et le coach) : les créneaux d'une heure, libres ou déjà pris (sans dire par qui)
  async planning(profId: string): Promise<{ days: PlanDay[] }> {
    await this.assertBookable(profId);
    const p = await this.prisma.profProfile.findUniqueOrThrow({ where: { userId: profId }, include: { slots: true } });
    return { days: buildPlanning(p.slots, await this.busyOf(profId), undefined, p.skipHolidays) };
  }

  // Vérifie qu'un créneau est proposé par le professeur ET libre : 400 s'il n'est pas dans son planning, 409 s'il est déjà pris
  async assertSlotFree(profId: string, slot: { date: string; time: string }, exceptLessonId?: string) {
    await this.assertBookable(profId);
    const p = await this.prisma.profProfile.findUniqueOrThrow({ where: { userId: profId }, include: { slots: true } });
    const hit = buildPlanning(p.slots, await this.busyOf(profId, exceptLessonId), undefined, p.skipHolidays).find((d) => d.date === slot.date)?.slots.find((s) => s.time === slot.time);
    if (!hit) throw new BadRequestException("Ce créneau n'est pas proposé par le professeur.");
    if (!hit.free) throw new ConflictException("Ce créneau est déjà pris. Choisis-en un autre.");
  }

  // Le professeur (ou le coach) propose une date : elle ne doit pas chevaucher un autre cours de ce professeur
  async assertNoClash(profId: string, slot: { date: string; time: string }, exceptLessonId: string) {
    if ((await this.busyOf(profId, exceptLessonId)).some((b) => b.date === slot.date && overlaps(b.time, slot.time))) throw new ConflictException("Ce professeur a déjà un cours à ce moment-là.");
  }

  // ----- Espace du professeur -----
  // Un entraîneur qui n'a pas (encore) choisi de donner des cours reçoit seulement { optedIn: false }
  async me(user: AuthUser) {
    if (user.role !== Role.TRAINER) throw new ForbiddenException("Réservé aux entraîneurs.");
    const u = await this.prisma.user.findFirst({ where: { id: user.id, deletedAt: null, profProfile: { isNot: null } } });
    if (!u) return { optedIn: false, prices: { member: PRICE_MEMBER, other: PRICE_OTHER } };
    const p = await this.profile(user.id);
    return {
      optedIn: true,
      firstName: u.firstName, lastName: u.lastName, birthYear: p.birthYear, showAge: p.showAge, ranking: p.ranking, bestRanking: p.bestRanking, bio: p.bio, paused: p.paused, skipHolidays: p.skipHolidays,
      status: this.status(p), approved: !!p.approvedAt, slots: this.slotsOut(p.slots), updatedAt: p.updatedAt, documents: p.documents, prices: { member: PRICE_MEMBER, other: PRICE_OTHER },
    };
  }

  // « Je souhaite donner des cours particuliers » : crée la fiche (invisible des adultes tant que les documents ne sont pas validés)
  async optIn(user: AuthUser) {
    if (user.role !== Role.TRAINER) throw new ForbiddenException("Réservé aux entraîneurs.");
    await this.profile(user.id);
    await this.audit.log(user.id, "prof-optin", "User", user.id);
    return this.me(user);
  }

  // Arrêter : la fiche, les disponibilités et les pièces sont effacées ; les demandes en cours reviennent au coach
  async optOut(user: AuthUser) {
    await this.assertProf(user.id);
    await releaseProfLessons(this.prisma, user.id);
    await this.prisma.profProfile.deleteMany({ where: { userId: user.id } });
    await this.audit.log(user.id, "prof-optout", "User", user.id);
    return this.me(user);
  }

  async updateMe(user: AuthUser, dto: ProfProfileDto) {
    await this.assertProf(user.id);
    if (dto.lastName !== undefined) await this.prisma.user.update({ where: { id: user.id }, data: { lastName: dto.lastName || null } });
    const data = { ...(dto.birthYear !== undefined ? { birthYear: dto.birthYear } : {}), ...(dto.showAge !== undefined ? { showAge: dto.showAge } : {}), ...(dto.ranking !== undefined ? { ranking: dto.ranking || null } : {}), ...(dto.bestRanking !== undefined ? { bestRanking: dto.bestRanking || null } : {}), ...(dto.bio !== undefined ? { bio: dto.bio } : {}), ...(dto.paused !== undefined ? { paused: dto.paused } : {}), ...(dto.skipHolidays !== undefined ? { skipHolidays: dto.skipHolidays } : {}) };
    await this.prisma.profProfile.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
    return this.me(user);
  }

  async setSlots(user: AuthUser, slots: SlotDto[]) {
    await this.assertProf(user.id);
    const t = todayIso();
    for (const s of slots) {
      if ((s.weekday === undefined) === (s.date === undefined)) throw new BadRequestException("Chaque créneau est soit un jour de la semaine, soit une date précise.");
      if (s.end <= s.start) throw new BadRequestException("L'heure de fin doit être après l'heure de début.");
      if (s.date) {
        const d = new Date(`${s.date}T00:00:00Z`);
        if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s.date) throw new BadRequestException("Date invalide.");
        if (s.date < t) throw new BadRequestException("Choisis une date à venir.");
      }
    }
    await this.profile(user.id);
    await this.prisma.$transaction([
      this.prisma.profSlot.deleteMany({ where: { userId: user.id } }),
      this.prisma.profSlot.createMany({ data: slots.map((s) => ({ userId: user.id, weekday: s.weekday ?? null, date: s.date ?? null, start: s.start, end: s.end })) }),
      this.prisma.profProfile.update({ where: { userId: user.id }, data: { updatedAt: new Date() } }), // « dernière mise à jour » des disponibilités
    ]);
    // Cours déjà réservés ou confirmés qui ne tombent plus dans les nouvelles disponibilités : on les signale (rien n'est annulé tout seul)
    const lessons = await this.prisma.lessonRequest.findMany({ where: { profId: user.id, status: { in: ["BOOKED", "ACCEPTED"] } }, select: { finalSlot: true } });
    const today = todayIso();
    const outside = lessons.filter((l) => { const f = l.finalSlot as { date?: string; time?: string } | null; return !!f?.date && !!f.time && f.date >= today && !coversSlot(slots.map((x) => ({ weekday: x.weekday ?? null, date: x.date ?? null, start: x.start, end: x.end })), f.date, f.time); }).length;
    return { ...(await this.me(user)), outsideCount: outside };
  }

  async putDocument(user: AuthUser, kind: DocKind, q: { fileName?: string; validUntil?: string }, body: unknown) {
    await this.assertProf(user.id);
    if (!Buffer.isBuffer(body) || !body.length) throw new BadRequestException("Document vide ou illisible.");
    if (body.length > MAX_DOC_BYTES) throw new BadRequestException("Document trop lourd (3 Mo maximum).");
    const fileName = cleanName(q.fileName ?? "");
    const type = sniffDoc(body, fileName);
    if (!type || !type.inline) throw new BadRequestException("Format non accepté : PDF ou photo (JPEG ou PNG).");
    let validUntil: Date | null = null;
    if (kind === "CARTE_PRO") {
      if (!q.validUntil || !/^\d{4}-\d{2}-\d{2}$/.test(q.validUntil)) throw new BadRequestException("Indique la date de fin de validité de ta carte professionnelle.");
      validUntil = new Date(`${q.validUntil}T00:00:00Z`);
      if (Number.isNaN(validUntil.getTime()) || validUntil.toISOString().slice(0, 10) !== q.validUntil) throw new BadRequestException("Date de validité invalide.");
      if (q.validUntil < todayIso()) throw new BadRequestException("Ta carte professionnelle n'est plus valable.");
    }
    await this.profile(user.id);
    await this.prisma.$transaction([
      this.prisma.profDocument.upsert({
        where: { userId_kind: { userId: user.id, kind } },
        update: { fileName, mimeType: type.mime, sizeBytes: body.length, data: Uint8Array.from(body), validUntil, uploadedAt: new Date() },
        create: { userId: user.id, kind, fileName, mimeType: type.mime, sizeBytes: body.length, data: Uint8Array.from(body), validUntil },
      }),
      this.prisma.profProfile.update({ where: { userId: user.id }, data: { approvedAt: null } }), // un document changé : le coach doit revalider
    ]);
    await this.audit.log(user.id, "prof-document-upload", "ProfDocument", kind);
    return this.me(user);
  }

  async deleteDocument(user: AuthUser, kind: DocKind) {
    await this.assertProf(user.id);
    await this.prisma.$transaction([
      this.prisma.profDocument.deleteMany({ where: { userId: user.id, kind } }),
      this.prisma.profProfile.updateMany({ where: { userId: user.id }, data: { approvedAt: null } }),
    ]);
    await this.audit.log(user.id, "prof-document-delete", "ProfDocument", kind);
    return this.me(user);
  }

  // Le coach (ou le professeur lui-même) ouvre un document ; jamais un autre professeur ni un adulte
  async file(user: AuthUser, ownerId: string, kind: DocKind) {
    if (user.role !== Role.COACH && user.id !== ownerId) throw new NotFoundException("Document introuvable");
    const d = await this.prisma.profDocument.findUnique({ where: { userId_kind: { userId: ownerId, kind } } });
    if (!d) throw new NotFoundException("Document introuvable");
    if (user.role === Role.COACH) await this.audit.log(user.id, "view", "ProfDocument", `${ownerId}:${kind}`);
    return { data: Buffer.from(d.data), mime: d.mimeType, name: d.fileName };
  }

  // ----- Espace du coach -----
  async adminList() {
    const users = await this.prisma.user.findMany({ where: { role: Role.TRAINER, deletedAt: null, profProfile: { isNot: null } }, orderBy: { createdAt: "asc" }, include: { profProfile: { include: { slots: true, documents: { select: { kind: true, fileName: true, validUntil: true, uploadedAt: true, sizeBytes: true } } } } } });
    const counts = await this.prisma.lessonRequest.groupBy({ by: ["profId"], where: { profId: { in: users.map((u) => u.id) } }, _count: { _all: true } });
    return users.map((u) => {
      const p = u.profProfile ?? { approvedAt: null, paused: false, documents: [], slots: [], birthYear: null, showAge: false, ranking: null, bestRanking: null, bio: "" };
      return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, birthYear: p.birthYear, showAge: p.showAge, ranking: p.ranking, bestRanking: p.bestRanking, bio: p.bio, paused: p.paused, status: this.status(p), approvedAt: p.approvedAt, documents: p.documents, slotCount: p.slots.length, requests: counts.find((c) => c.profId === u.id)?._count._all ?? 0 };
    });
  }

  async approve(user: AuthUser, id: string, approved: boolean) {
    await this.assertProf(id);
    const p = await this.profile(id);
    if (approved) {
      const st = this.status({ ...p, approvedAt: new Date() });
      if (st === "missing") throw new BadRequestException("Il manque au moins un des trois documents.");
      if (st === "expired") throw new BadRequestException("La carte professionnelle a expiré ou n'a pas de date de validité.");
    }
    await this.prisma.profProfile.update({ where: { userId: id }, data: { approvedAt: approved ? new Date() : null } });
    await this.audit.log(user.id, approved ? "prof-approve" : "prof-unapprove", "User", id);
    return { approved };
  }
}
