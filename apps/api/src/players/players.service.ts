import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsentKind, GoalStatus, Player, Role } from "@prisma/client";
import { randomBytes, randomInt } from "crypto";
import { hash } from "@node-rs/argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser } from "../common/auth.types";
import { sha256, POLICY_VERSION } from "../auth/auth.service";
import { CheckpointDto, ConsentDto, CreatePlayerDto, EvaluationDto, GoalDto, InvitationDto, MatchDto, SelfEvaluationDto, UpdateGoalDto, UpdatePlayerDto } from "./dto";

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
    const p = await this.prisma.player.findUnique({ where: { id }, include: { goals: { include: { checkpoints: true } }, evaluations: true, selfEvaluations: true, matches: true, consents: true, analyses: { select: { id: true, observation: true, strengths: true, improve: true, createdAt: true } }, videos: { select: { title: true, shot: true, recordedAt: true } } } });
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
    const consent = await this.prisma.consent.findFirst({ where: { id: consentId, playerId, withdrawnAt: null } });
    if (!consent) throw new NotFoundException("Accord introuvable");
    await this.prisma.consent.update({ where: { id: consentId }, data: { withdrawnAt: new Date() } });
    // Retrait du droit à l'image : les vidéos du joueur sont supprimées (les textes d'analyse restent).
    if (consent.kind === ConsentKind.IMAGE) await this.prisma.video.deleteMany({ where: { playerId } });
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

  // ----- Accès créé directement par le coach : identifiant (e-mail) + mot de passe provisoire -----
  // Le mot de passe provisoire est montré UNE seule fois et doit être changé à la première connexion :
  // le coach ne connaît jamais le mot de passe définitif.
  async createAccess(user: AuthUser, playerId: string, dto: InvitationDto) {
    this.assertCoach(user);
    if (!(await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }))) throw new NotFoundException("Fiche introuvable");
    if (dto.role === Role.YOUTH) {
      const ok = await this.prisma.consent.findFirst({ where: { playerId, kind: ConsentKind.ACCOUNT, withdrawnAt: null } });
      if (!ok) throw new ForbiddenException("L'accord des parents pour un compte en ligne n'est pas encore enregistré.");
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Un parent qui a déjà un compte (ex. deux enfants au club) reçoit simplement l'accès à la nouvelle fiche.
      if (existing.deletedAt || existing.role !== dto.role || dto.role !== Role.GUARDIAN) throw new ConflictException("Cet e-mail est déjà utilisé par un autre compte.");
      await this.prisma.playerAccess.upsert({ where: { userId_playerId: { userId: existing.id, playerId } }, update: {}, create: { userId: existing.id, playerId, relation: "parent" } });
      await this.audit.log(user.id, "grant-access", "Player", playerId);
      return { email: dto.email, existingAccount: true as const };
    }
    const temporaryPassword = this.generatePassword();
    const created = await this.prisma.user.create({ data: { email: dto.email, role: dto.role, passwordHash: await hash(temporaryPassword), mustChangePassword: true } });
    await this.prisma.playerAccess.create({ data: { userId: created.id, playerId, relation: dto.role === Role.YOUTH ? "jeune" : "parent" } });
    await this.audit.log(user.id, "create-access", "Player", playerId);
    return { email: dto.email, existingAccount: false as const, temporaryPassword };
  }
  // Qui a accès à la fiche (pour que le coach puisse retirer un accès)
  async listAccess(user: AuthUser, playerId: string) {
    this.assertCoach(user);
    const rows = await this.prisma.playerAccess.findMany({ where: { playerId }, include: { user: { select: { id: true, email: true, role: true, mustChangePassword: true, lastLoginAt: true } } } });
    return rows.map((r) => ({ userId: r.user.id, email: r.user.email, role: r.user.role, relation: r.relation, mustChangePassword: r.user.mustChangePassword, lastLoginAt: r.user.lastLoginAt }));
  }

  // Retire l'accès d'une personne à la fiche ; si elle n'a plus aucun accès, son compte est supprimé et ses sessions fermées.
  async revokeAccess(user: AuthUser, playerId: string, userId: string) {
    this.assertCoach(user);
    const r = await this.prisma.playerAccess.deleteMany({ where: { playerId, userId } });
    if (!r.count) throw new NotFoundException("Accès introuvable");
    const remaining = await this.prisma.playerAccess.count({ where: { userId } });
    if (!remaining) {
      await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({ where: { userId } }),
        this.prisma.user.update({ where: { id: userId }, data: { email: `supprime-${userId}@invalid`, firstName: null, passwordHash: "-", deletedAt: new Date() } }),
      ]);
    }
    await this.audit.log(user.id, "revoke-access", "Player", playerId);
  }

  private generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sans caractères qu'on confond (0/O, 1/l/I)
    return Array.from({ length: 14 }, () => alphabet[randomInt(alphabet.length)]).join("");
  }

  // ----- Objectifs -----
  async goals(user: AuthUser, playerId: string, season?: string) {
    await this.assertCanRead(user, playerId);
    if (season && !SEASON.test(season)) throw new BadRequestException("Saison invalide");
    return this.prisma.goal.findMany({ where: { playerId, ...(season ? { season } : {}) }, orderBy: { createdAt: "asc" }, include: { checkpoints: { select: { trimester: true, status: true, progress: true, comment: true }, orderBy: { trimester: "asc" } } } });
  }
  async addGoal(user: AuthUser, playerId: string, dto: GoalDto) {
    this.assertCoach(user);
    const g = await this.prisma.goal.create({ data: { playerId, season: dto.season, axis: dto.axis, title: dto.title, indicator: dto.indicator ?? "", deadline: dto.deadline ? new Date(dto.deadline) : null, progress: dto.progress ?? 0, trimesters: this.trimesters(dto.trimesters) } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return g;
  }
  async updateGoal(user: AuthUser, goalId: string, dto: UpdateGoalDto) {
    this.assertCoach(user);
    const { deadline, trimesters, ...rest } = dto;
    const g = await this.prisma.goal.update({ where: { id: goalId }, data: { ...rest, ...(deadline ? { deadline: new Date(deadline) } : {}), ...(trimesters ? { trimesters: this.trimesters(trimesters) } : {}) } }).catch(() => { throw new NotFoundException("Objectif introuvable"); });
    await this.touch(g.playerId);
    return g;
  }
  // Trimestres où l'objectif est à travailler : sans doublon, triés ; vide = toute la saison
  private trimesters(t?: number[]) { return [...new Set(t ?? [])].sort(); }

  // Point de contrôle : où en est l'objectif à la fin d'un trimestre + la note du coach.
  // L'avancement « actuel » de l'objectif suit le point de contrôle du dernier trimestre renseigné.
  async saveCheckpoint(user: AuthUser, goalId: string, trimester: number, dto: CheckpointDto) {
    this.assertCoach(user);
    if (![1, 2, 3].includes(trimester)) throw new BadRequestException("Trimestre invalide");
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId }, select: { id: true, playerId: true, season: true } });
    if (!goal) throw new NotFoundException("Objectif introuvable");
    const data = { progress: dto.progress, comment: dto.comment ?? "", status: dto.status ?? (dto.progress >= 100 ? GoalStatus.ACHIEVED : GoalStatus.IN_PROGRESS) };
    const cp = await this.prisma.goalCheckpoint.upsert({ where: { goalId_trimester: { goalId, trimester } }, update: data, create: { goalId, trimester, ...data } });
    const latest = await this.prisma.goalCheckpoint.findFirst({ where: { goalId }, orderBy: { trimester: "desc" } });
    await this.prisma.goal.update({ where: { id: goalId }, data: { progress: latest!.progress } });
    // Évaluer un objectif crée le bulletin du trimestre s'il n'existe pas encore (les compétences restent facultatives)
    await this.prisma.evaluation.upsert({ where: { playerId_season_trimester: { playerId: goal.playerId, season: goal.season, trimester } }, update: {}, create: { playerId: goal.playerId, season: goal.season, trimester } });
    await this.touch(goal.playerId);
    return { trimester: cp.trimester, status: cp.status, progress: cp.progress, comment: cp.comment };
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
    if (!SEASON.test(season) || ![0, 1, 2, 3].includes(trimester)) throw new BadRequestException("Période invalide"); // 0 = bilan de début d'année
    for (const [k, v] of Object.entries(dto.ratings ?? {})) {
      if (!/^[a-z_]{1,40}$/.test(k) || !Number.isInteger(v) || v < 1 || v > 5) throw new BadRequestException("Notes invalides (1 à 5)");
    }
    const data = { ratings: dto.ratings ?? {}, comments: dto.comments ?? {}, strengths: dto.strengths ?? "", improve: dto.improve ?? "", next: dto.next ?? "", appreciation: dto.appreciation ?? "" };
    const e = await this.prisma.evaluation.upsert({ where: { playerId_season_trimester: { playerId, season, trimester } }, update: data, create: { playerId, season, trimester, ...data } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return e;
  }

  // ----- Auto-évaluation du jeune (fin de trimestre) -----
  // Écrit par le jeune (ou son parent) seulement ; le coach ne voit que ce qui a été ENVOYÉ.
  async selfEvaluations(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    return this.prisma.selfEvaluation.findMany({ where: { playerId, ...(user.role === Role.COACH ? { sentAt: { not: null } } : {}) }, orderBy: [{ season: "desc" }, { trimester: "desc" }] });
  }
  private assertWriter(user: AuthUser) { if (user.role !== Role.YOUTH && user.role !== Role.GUARDIAN) throw new ForbiddenException("Réservé au jeune et à sa famille"); }
  private checkPeriod(season: string, trimester: number) { if (!SEASON.test(season) || ![1, 2, 3].includes(trimester)) throw new BadRequestException("Période invalide"); }
  async saveSelfEvaluation(user: AuthUser, playerId: string, season: string, trimester: number, dto: SelfEvaluationDto) {
    this.assertWriter(user);
    await this.assertCanRead(user, playerId);
    this.checkPeriod(season, trimester);
    for (const [k, v] of Object.entries(dto.ratings ?? {})) {
      if (!/^[a-z_]{1,40}$/.test(k) || !Number.isInteger(v) || v < 1 || v > 5) throw new BadRequestException("Notes invalides (1 à 5)");
    }
    const statuses = Object.values(GoalStatus) as string[];
    const goalIds = Object.keys(dto.goals ?? {});
    for (const v of Object.values(dto.goals ?? {})) if (!statuses.includes(v)) throw new BadRequestException("Statut invalide");
    if (goalIds.length) {
      const n = await this.prisma.goal.count({ where: { id: { in: goalIds }, playerId } });
      if (n !== goalIds.length) throw new BadRequestException("Objectif inconnu");
    }
    const existing = await this.prisma.selfEvaluation.findUnique({ where: { playerId_season_trimester: { playerId, season, trimester } } });
    if (existing?.sentAt) throw new ConflictException("Ce bulletin est déjà envoyé au coach");
    const data = { mood: dto.mood ?? null, ratings: dto.ratings ?? {}, goals: dto.goals ?? {}, proud: dto.proud ?? [], improve: dto.improve ?? [], wish: dto.wish ?? [], comment: (dto.comment ?? "").trim() };
    return this.prisma.selfEvaluation.upsert({ where: { playerId_season_trimester: { playerId, season, trimester } }, update: data, create: { playerId, season, trimester, ...data } });
  }
  async sendSelfEvaluation(user: AuthUser, playerId: string, season: string, trimester: number) {
    this.assertWriter(user);
    await this.assertCanRead(user, playerId);
    this.checkPeriod(season, trimester);
    const e = await this.prisma.selfEvaluation.findUnique({ where: { playerId_season_trimester: { playerId, season, trimester } } });
    if (!e) throw new NotFoundException("Rien à envoyer : remplis d'abord ton bulletin");
    if (e.sentAt) throw new ConflictException("Ce bulletin est déjà envoyé au coach");
    const sent = await this.prisma.selfEvaluation.update({ where: { id: e.id }, data: { sentAt: new Date() } });
    await this.touch(playerId);
    await this.audit.log(user.id, "self-evaluation-sent", "Player", playerId);
    return sent;
  }
  async markSelfEvaluationRead(user: AuthUser, playerId: string, season: string, trimester: number) {
    this.assertCoach(user);
    this.checkPeriod(season, trimester);
    const e = await this.prisma.selfEvaluation.findUnique({ where: { playerId_season_trimester: { playerId, season, trimester } } });
    if (!e?.sentAt) throw new NotFoundException("Bulletin introuvable");
    return this.prisma.selfEvaluation.update({ where: { id: e.id }, data: { readAt: new Date() } });
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
