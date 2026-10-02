import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Player, Role } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser } from "../common/auth.types";
import { sha256, POLICY_VERSION } from "../auth/auth.service";
import { ConsentDto, CreatePlayerDto, EvaluationDto, GoalDto, InvitationDto, MatchDto, UpdateGoalDto, UpdatePlayerDto } from "./dto";

const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;
const SEASON = /^\d{4}-\d{4}$/;

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ----- Qui a le droit de voir quelle fiche -----
  async assertCanRead(user: AuthUser, playerId: string) {
    if (user.role === Role.COACH) return;
    const access = await this.prisma.playerAccess.findUnique({ where: { userId_playerId: { userId: user.id, playerId } } });
    if (!access) throw new NotFoundException("Fiche introuvable"); // 404 plutôt que 403 : on ne révèle pas son existence
  }
  assertCoach(user: AuthUser) { if (user.role !== Role.COACH) throw new ForbiddenException("Réservé au coach"); }

  // Ce que voit chaque rôle : jamais les notes privées du coach en dehors du coach, et pas la santé pour un compte « jeune ».
  private shape(p: Player, user: AuthUser) {
    const { coachNotes, health, ...rest } = p;
    if (user.role === Role.COACH) return p;
    return user.role === Role.GUARDIAN ? { ...rest, health } : rest;
  }
  private async touch(playerId: string) { await this.prisma.player.update({ where: { id: playerId }, data: { lastActivityAt: new Date() } }); }

  async list(user: AuthUser) {
    const where = user.role === Role.COACH ? { archivedAt: null } : { accesses: { some: { userId: user.id } } };
    const rows = await this.prisma.player.findMany({ where, orderBy: { firstName: "asc" } });
    return rows.map((p) => this.shape(p, user));
  }

  async get(user: AuthUser, id: string) {
    await this.assertCanRead(user, id);
    const p = await this.prisma.player.findUnique({ where: { id }, include: { consents: { select: { id: true, kind: true, givenBy: true, method: true, grantedAt: true, withdrawnAt: true } } } });
    if (!p) throw new NotFoundException("Fiche introuvable");
    const { consents, ...player } = p;
    return { ...this.shape(player as Player, user), consents: user.role === Role.COACH ? consents : undefined };
  }

  async create(user: AuthUser, dto: CreatePlayerDto) {
    this.assertCoach(user);
    const p = await this.prisma.player.create({ data: { firstName: dto.firstName, lastName: dto.lastName ?? "", birthDate: dto.birthDate ? new Date(dto.birthDate) : null, ranking: dto.ranking } });
    await this.audit.log(user.id, "create", "Player", p.id);
    return p;
  }

  async update(user: AuthUser, id: string, dto: UpdatePlayerDto) {
    this.assertCoach(user);
    const { birthDate, ...rest } = dto;
    const p = await this.prisma.player.update({ where: { id }, data: { ...rest, ...(birthDate ? { birthDate: new Date(birthDate) } : {}), lastActivityAt: new Date() } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.audit.log(user.id, "update", "Player", id);
    return p;
  }

  // Droit à l'effacement : la fiche et TOUT ce qui s'y rattache disparaissent (objectifs, évaluations, matchs, analyses, accords).
  async remove(user: AuthUser, id: string) {
    this.assertCoach(user);
    await this.prisma.$transaction([
      this.prisma.video.deleteMany({ where: { playerId: id } }),
      this.prisma.player.delete({ where: { id } }),
    ]).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.audit.log(user.id, "erase", "Player", id);
  }

  // Droit d'accès / portabilité : copie complète d'une fiche.
  async export(user: AuthUser, id: string) {
    await this.assertCanRead(user, id);
    const p = await this.prisma.player.findUnique({ where: { id }, include: { goals: true, evaluations: true, matches: true, consents: true, analyses: { select: { id: true, observation: true, strengths: true, improve: true, createdAt: true } }, videos: { select: { title: true, shot: true, recordedAt: true } } } });
    if (!p) throw new NotFoundException("Fiche introuvable");
    await this.audit.log(user.id, "export", "Player", id);
    const { coachNotes, ...visible } = p;
    return { exportedAt: new Date().toISOString(), ...(user.role === Role.COACH ? p : visible) };
  }

  // Dossiers sans activité depuis plus de 12 mois (durée de conservation)
  async inactive(user: AuthUser) {
    this.assertCoach(user);
    const limit = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    return this.prisma.player.findMany({ where: { lastActivityAt: { lt: limit } }, select: { id: true, firstName: true, lastName: true, lastActivityAt: true } });
  }

  // ----- Accords (droit à l'image, suivi, santé, compte) -----
  async addConsent(user: AuthUser, playerId: string, dto: ConsentDto) {
    this.assertCoach(user);
    const c = await this.prisma.consent.create({ data: { kind: dto.kind, givenBy: dto.givenBy, method: dto.method, playerId, policyVersion: POLICY_VERSION } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    await this.audit.log(user.id, "consent", "Player", playerId);
    return c;
  }
  async withdrawConsent(user: AuthUser, playerId: string, consentId: string) {
    this.assertCoach(user);
    const r = await this.prisma.consent.updateMany({ where: { id: consentId, playerId, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
    if (!r.count) throw new NotFoundException("Accord introuvable");
    await this.audit.log(user.id, "consent-withdraw", "Player", playerId);
  }

  // ----- Invitations : le lien est donné au coach une seule fois (aucun e-mail envoyé par l'application) -----
  async invite(user: AuthUser, playerId: string, dto: InvitationDto) {
    this.assertCoach(user);
    if (!(await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }))) throw new NotFoundException("Fiche introuvable");
    const token = randomBytes(32).toString("base64url");
    await this.prisma.invitation.create({ data: { tokenHash: sha256(token), email: dto.email, role: dto.role, playerId, invitedById: user.id, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) } });
    await this.audit.log(user.id, "invite", "Player", playerId);
    return { token, expiresInDays: 7 };
  }

  // ----- Objectifs -----
  async goals(user: AuthUser, playerId: string, season?: string) {
    await this.assertCanRead(user, playerId);
    if (season && !SEASON.test(season)) throw new BadRequestException("Saison invalide");
    return this.prisma.goal.findMany({ where: { playerId, ...(season ? { season } : {}) }, orderBy: { createdAt: "asc" } });
  }
  async addGoal(user: AuthUser, playerId: string, dto: GoalDto) {
    this.assertCoach(user);
    const g = await this.prisma.goal.create({ data: { playerId, season: dto.season, axis: dto.axis, title: dto.title, indicator: dto.indicator ?? "", deadline: dto.deadline ? new Date(dto.deadline) : null, progress: dto.progress ?? 0 } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return g;
  }
  async updateGoal(user: AuthUser, goalId: string, dto: UpdateGoalDto) {
    this.assertCoach(user);
    const { deadline, ...rest } = dto;
    const g = await this.prisma.goal.update({ where: { id: goalId }, data: { ...rest, ...(deadline ? { deadline: new Date(deadline) } : {}) } }).catch(() => { throw new NotFoundException("Objectif introuvable"); });
    await this.touch(g.playerId);
    return g;
  }
  async removeGoal(user: AuthUser, goalId: string) {
    this.assertCoach(user);
    await this.prisma.goal.delete({ where: { id: goalId } }).catch(() => { throw new NotFoundException("Objectif introuvable"); });
  }

  // ----- Évaluations trimestrielles -----
  async evaluations(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    return this.prisma.evaluation.findMany({ where: { playerId }, orderBy: [{ season: "desc" }, { trimester: "desc" }] });
  }
  async saveEvaluation(user: AuthUser, playerId: string, season: string, trimester: number, dto: EvaluationDto) {
    this.assertCoach(user);
    if (!SEASON.test(season) || ![1, 2, 3].includes(trimester)) throw new BadRequestException("Période invalide");
    for (const [k, v] of Object.entries(dto.ratings ?? {})) {
      if (!/^[a-z_]{1,40}$/.test(k) || !Number.isInteger(v) || v < 1 || v > 5) throw new BadRequestException("Notes invalides (1 à 5)");
    }
    const data = { ratings: dto.ratings ?? {}, comments: dto.comments ?? {}, strengths: dto.strengths ?? "", improve: dto.improve ?? "", next: dto.next ?? "", appreciation: dto.appreciation ?? "" };
    const e = await this.prisma.evaluation.upsert({ where: { playerId_season_trimester: { playerId, season, trimester } }, update: data, create: { playerId, season, trimester, ...data } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return e;
  }

  // ----- Matchs -----
  async matches(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    return this.prisma.match.findMany({ where: { playerId }, orderBy: { date: "desc" } });
  }
  async addMatch(user: AuthUser, playerId: string, dto: MatchDto) {
    this.assertCoach(user);
    const m = await this.prisma.match.create({ data: { playerId, date: new Date(dto.date), tournament: dto.tournament, round: dto.round ?? "", result: dto.result, score: dto.score ?? "", remark: dto.remark ?? "" } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return m;
  }
  async removeMatch(user: AuthUser, matchId: string) {
    this.assertCoach(user);
    await this.prisma.match.delete({ where: { id: matchId } }).catch(() => { throw new NotFoundException("Match introuvable"); });
  }
}
