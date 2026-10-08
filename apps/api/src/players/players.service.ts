import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsentKind, GoalStatus, Player, Role } from "@prisma/client";
import { randomBytes, randomInt } from "crypto";
import { hash } from "@node-rs/argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, isStaff } from "../common/auth.types";
import { sha256, POLICY_VERSION } from "../auth/auth.service";
import { FamilyInfoDto, QualitiesDto, STAR_NEG_REASONS, StarLineDto, CheckpointDto, ConsentDto, CreatePlayerDto, EvaluationDto, GoalDto, InvitationDto, DeclaredMatchDto, MatchCommentDto, MatchDto, SelfEvaluationDto, StarsDayDto, UpdateGoalDto, UpdatePlayerDto } from "./dto";

const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;
const SEASON = /^\d{4}-\d{4}$/;
// Un trimestre « s'ouvre » au jeune et à sa famille le 1er décembre (T1), le 1er mars (T2) et le 1er juin (T3) : avant, ni bulletin ni résultat des missions
const trimesterOpen = (season: string, t: number, now = new Date()) => { if (t < 1) return true; const y = Number(season.slice(0, 4)); return now >= new Date(Date.UTC(t === 1 ? y : y + 1, t === 1 ? 11 : t === 2 ? 2 : 5, 1)); };

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
  // Saisie du suivi : le coach partout ; un entraîneur de comité seulement pour les jeunes qui lui sont confiés (sinon la fiche « n'existe pas » pour lui).
  async assertStaffFor(user: AuthUser, playerId: string) {
    if (user.role === Role.COACH) return;
    if (user.role !== Role.TRAINER) throw new ForbiddenException("Réservé au coach");
    await this.assertCanRead(user, playerId);
  }

  // Ce que voit chaque rôle : jamais les notes privées du coach en dehors du coach, et pas la santé pour un compte « jeune ».
  private shape(p: Player, user: AuthUser) {
    const { coachNotes, health, ...rest } = p;
    if (user.role === Role.COACH) return p;
    return user.role === Role.GUARDIAN ? { ...rest, health } : rest;
  }
  // Qui saisit : le nom et le rôle sont gardés avec chaque saisie pour l'afficher en couleur (coach ≠ entraîneur) ; jamais montrés aux familles
  private async who(user: AuthUser) {
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true } });
    return { authorId: user.id, authorName: u?.firstName || (user.role === Role.COACH ? "Coach" : "Entraîneur"), authorRole: user.role as string };
  }
  private hideAuthors<T extends Record<string, any>>(user: AuthUser, rows: T[]): T[] {
    if (isStaff(user)) return rows;
    return rows.map((r) => { const { authorId, authorName, authorRole, ...rest } = r as any; if (Array.isArray(rest.checkpoints)) rest.checkpoints = rest.checkpoints.map(({ authorId: a, authorName: b, authorRole: c, ...cp }: any) => cp); return rest as T; });
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
    if (isStaff(user)) await this.audit.log(user.id, "read", "Player", id); // journal : le coach (ou l'entraîneur) a ouvert cette fiche
    const { consents, ...player } = p;
    return { ...this.shape(player as Player, user), consents: isStaff(user) ? consents : undefined };
  }

  async create(user: AuthUser, dto: CreatePlayerDto) {
    this.assertCoach(user);
    const p = await this.prisma.player.create({ data: { firstName: dto.firstName, lastName: dto.lastName ?? "", birthDate: dto.birthDate ? new Date(dto.birthDate) : null, ranking: dto.ranking } });
    await this.audit.log(user.id, "create", "Player", p.id);
    return p;
  }

  async update(user: AuthUser, id: string, dto: UpdatePlayerDto) {
    await this.assertStaffFor(user, id);
    const { birthDate, ...rest } = dto;
    if (user.role === Role.TRAINER) { delete rest.health; delete rest.coachNotes; } // santé et notes privées : réservées au coach
    const p = await this.prisma.player.update({ where: { id }, data: { ...rest, ...(birthDate ? { birthDate: new Date(birthDate) } : {}), lastActivityAt: new Date() } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.audit.log(user.id, "update", "Player", id);
    return p;
  }

  // Renseignements remplis par les parents : seulement leur enfant, jamais le nom / prénom / date de naissance ni les notes du coach
  async updateFamilyInfo(user: AuthUser, id: string, dto: FamilyInfoDto) {
    if (user.role !== Role.GUARDIAN) throw new ForbiddenException("Réservé aux parents");
    await this.assertCanRead(user, id);
    const data: Record<string, unknown> = {};
    for (const k of ["sex", "club", "licence", "ranking", "hand", "backhand", "training", "availability", "health"] as const) if (dto[k] !== undefined) data[k] = dto[k] === "" ? null : dto[k];
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    const p = await this.prisma.player.update({ where: { id }, data: { ...data, lastActivityAt: new Date() } });
    await this.audit.log(user.id, "family-update", "Player", id);
    return this.shape(p, user);
  }

  // Droit à l'effacement : la fiche et TOUT ce qui s'y rattache disparaissent (objectifs, évaluations, matchs, analyses, accords).
  async remove(user: AuthUser, id: string) {
    this.assertCoach(user);
    await this.prisma.$transaction([
      this.prisma.video.deleteMany({ where: { playerId: id } }),
      this.prisma.player.delete({ where: { id } }),
    ]).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.prisma.tournamentDoc.deleteMany({ where: { players: { none: {} } } }); // un document qui ne concerne plus personne est supprimé
    await this.audit.log(user.id, "erase", "Player", id);
  }

  // Droit d'accès / portabilité : copie complète d'une fiche.
  async export(user: AuthUser, id: string) {
    if (user.role === Role.TRAINER) throw new ForbiddenException("Réservé au coach");
    await this.assertCanRead(user, id);
    const p = await this.prisma.player.findUnique({ where: { id }, include: { goals: { include: { checkpoints: true } }, evaluations: true, selfEvaluations: true, courseStars: true, qualities: true, declaredMatches: true, matches: true, consents: true, analyses: { select: { id: true, observation: true, strengths: true, improve: true, createdAt: true } }, videos: { select: { title: true, shot: true, recordedAt: true } } } });
    if (!p) throw new NotFoundException("Fiche introuvable");
    await this.audit.log(user.id, "export", "Player", id);
    const { coachNotes, declaredMatches, ...visible } = p;
    // Les matchs déclarés par le jeune ne sont jamais montrés aux parents (même dans leur copie des données)
    const forYouth = user.role === Role.YOUTH ? { ...visible, declaredMatches } : visible;
    const out = { exportedAt: new Date().toISOString(), ...(user.role === Role.COACH ? p : forYouth) };
    return user.role === Role.COACH ? out : JSON.parse(JSON.stringify(out, (k, v) => (["authorId", "authorName", "authorRole"].includes(k) ? undefined : v))); // jamais le nom d'un entraîneur chez la famille
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

  // Mot de passe oublié par un parent ou un jeune : le coach donne un nouveau mot de passe provisoire (à changer à la prochaine connexion).
  async resetPassword(user: AuthUser, playerId: string, userId: string) {
    this.assertCoach(user);
    const access = await this.prisma.playerAccess.findUnique({ where: { userId_playerId: { userId, playerId } }, include: { user: true } });
    if (!access || access.user.deletedAt || (access.user.role !== Role.GUARDIAN && access.user.role !== Role.YOUTH)) throw new NotFoundException("Accès introuvable");
    const temporaryPassword = this.generatePassword();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(temporaryPassword), mustChangePassword: true, failedLogins: 0, lockedUntil: null } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }), // toutes ses sessions sont fermées
    ]);
    await this.audit.log(user.id, "reset-password", "Player", playerId);
    return { email: access.user.email, temporaryPassword };
  }

  private generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sans caractères qu'on confond (0/O, 1/l/I)
    return Array.from({ length: 14 }, () => alphabet[randomInt(alphabet.length)]).join("");
  }

  // ----- Objectifs -----
  async goals(user: AuthUser, playerId: string, season?: string) {
    await this.assertCanRead(user, playerId);
    if (season && !SEASON.test(season)) throw new BadRequestException("Saison invalide");
    const rows = await this.prisma.goal.findMany({ where: { playerId, ...(season ? { season } : {}) }, orderBy: { createdAt: "asc" }, include: { checkpoints: { select: { trimester: true, status: true, progress: true, comment: true, authorId: true, authorName: true, authorRole: true }, orderBy: { trimester: "asc" } } } });
    if (isStaff(user)) return this.hideAuthors(user, rows);
    // Le jeune et sa famille ne voient le résultat d'une mission (atteinte / en cours / non atteinte, avancement, mot du coach) qu'à l'ouverture du trimestre
    const shown = rows.map((g) => {
      const cps = g.checkpoints.filter((c) => trimesterOpen(g.season, c.trimester));
      const last = cps.reduce<(typeof cps)[number] | null>((m, c) => (!m || c.trimester > m.trimester ? c : m), null);
      return { ...g, checkpoints: cps, progress: last ? last.progress : 0 };
    });
    return this.hideAuthors(user, shown);
  }
  async addGoal(user: AuthUser, playerId: string, dto: GoalDto) {
    await this.assertStaffFor(user, playerId);
    const who = await this.who(user);
    const g = await this.prisma.goal.create({ data: { ...who, playerId, season: dto.season, axis: dto.axis, title: dto.title, indicator: dto.indicator ?? "", deadline: dto.deadline ? new Date(dto.deadline) : null, progress: dto.progress ?? 0, trimesters: this.trimesters(dto.trimesters), ...(dto.targetStars ? { targetStars: dto.targetStars } : {}) } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return g;
  }
  private async goalOwner(user: AuthUser, goalId: string) {
    const g = await this.prisma.goal.findUnique({ where: { id: goalId }, select: { playerId: true } });
    if (!g) throw new NotFoundException("Objectif introuvable");
    await this.assertStaffFor(user, g.playerId);
  }
  async updateGoal(user: AuthUser, goalId: string, dto: UpdateGoalDto) {
    await this.goalOwner(user, goalId);
    const { deadline, trimesters, ...rest } = dto;
    const who = await this.who(user);
    const g = await this.prisma.goal.update({ where: { id: goalId }, data: { ...who, ...rest, ...(deadline ? { deadline: new Date(deadline) } : {}), ...(trimesters ? { trimesters: this.trimesters(trimesters) } : {}) } }).catch(() => { throw new NotFoundException("Objectif introuvable"); });
    await this.touch(g.playerId);
    return g;
  }
  // Trimestres où l'objectif est à travailler : sans doublon, triés ; vide = toute la saison
  private trimesters(t?: number[]) { return [...new Set(t ?? [])].sort(); }

  // Point de contrôle : où en est l'objectif à la fin d'un trimestre + la note du coach.
  // L'avancement « actuel » de l'objectif suit le point de contrôle du dernier trimestre renseigné.
  async saveCheckpoint(user: AuthUser, goalId: string, trimester: number, dto: CheckpointDto) {
    await this.goalOwner(user, goalId);
    if (![1, 2, 3].includes(trimester)) throw new BadRequestException("Trimestre invalide");
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId }, select: { id: true, playerId: true, season: true } });
    if (!goal) throw new NotFoundException("Objectif introuvable");
    const data = { ...(await this.who(user)), progress: dto.progress, comment: dto.comment ?? "", status: dto.status ?? (dto.progress >= 100 ? GoalStatus.ACHIEVED : GoalStatus.IN_PROGRESS) };
    const cp = await this.prisma.goalCheckpoint.upsert({ where: { goalId_trimester: { goalId, trimester } }, update: data, create: { goalId, trimester, ...data } });
    const latest = await this.prisma.goalCheckpoint.findFirst({ where: { goalId }, orderBy: { trimester: "desc" } });
    await this.prisma.goal.update({ where: { id: goalId }, data: { progress: latest!.progress } });
    // Évaluer un objectif crée le bulletin du trimestre s'il n'existe pas encore (les compétences restent facultatives)
    await this.prisma.evaluation.upsert({ where: { playerId_season_trimester: { playerId: goal.playerId, season: goal.season, trimester } }, update: {}, create: { playerId: goal.playerId, season: goal.season, trimester } });
    await this.touch(goal.playerId);
    return { trimester: cp.trimester, status: cp.status, progress: cp.progress, comment: cp.comment, authorId: cp.authorId, authorName: cp.authorName, authorRole: cp.authorRole };
  }

  async removeGoal(user: AuthUser, goalId: string) {
    await this.goalOwner(user, goalId);
    await this.prisma.goal.delete({ where: { id: goalId } }).catch(() => { throw new NotFoundException("Objectif introuvable"); });
  }

  // ----- Évaluations trimestrielles -----
  async evaluations(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    const rows = await this.prisma.evaluation.findMany({ where: { playerId }, orderBy: [{ season: "desc" }, { trimester: "desc" }] });
    // Le bulletin d'un trimestre ne se montre au jeune et à sa famille qu'à partir du 1er décembre (T1), du 1er mars (T2) et du 1er juin (T3)
    const visible = isStaff(user) ? rows : rows.filter((e) => trimesterOpen(e.season, e.trimester));
    return this.hideAuthors(user, visible);
  }
  async saveEvaluation(user: AuthUser, playerId: string, season: string, trimester: number, dto: EvaluationDto) {
    await this.assertStaffFor(user, playerId);
    if (!SEASON.test(season) || ![0, 1, 2, 3].includes(trimester)) throw new BadRequestException("Période invalide"); // 0 = bilan de début d'année
    for (const [k, v] of Object.entries(dto.ratings ?? {})) {
      if (!/^[a-z_]{1,40}$/.test(k) || !Number.isInteger(v) || v < 1 || v > 5) throw new BadRequestException("Notes invalides (1 à 5)");
    }
    const data = { ...(await this.who(user)), ratings: dto.ratings ?? {}, comments: dto.comments ?? {}, strengths: dto.strengths ?? "", improve: dto.improve ?? "", next: dto.next ?? "", appreciation: dto.appreciation ?? "" };
    const e = await this.prisma.evaluation.upsert({ where: { playerId_season_trimester: { playerId, season, trimester } }, update: data, create: { playerId, season, trimester, ...data } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return e;
  }

  // ----- Auto-évaluation du jeune (fin de trimestre) -----
  // Écrit par le jeune (ou son parent) seulement ; le coach ne voit que ce qui a été ENVOYÉ.
  async selfEvaluations(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    return this.prisma.selfEvaluation.findMany({ where: { playerId, ...(isStaff(user) ? { sentAt: { not: null } } : {}) }, orderBy: [{ season: "desc" }, { trimester: "desc" }] });
  }
  private assertWriter(user: AuthUser) { if (user.role !== Role.YOUTH && user.role !== Role.GUARDIAN) throw new ForbiddenException("Réservé au jeune et à sa famille"); }
  // L'auto-évaluation s'ouvre à la fin de chaque trimestre : 1er décembre (T1), 1er mars (T2), 1er juin (T3). Les périodes passées restent ouvertes.
  private checkOpen(season: string, trimester: number) {
    const start = Number(season.slice(0, 4)); const [yearOffset, month, label] = ({ 1: [0, 11, "décembre"], 2: [1, 2, "mars"], 3: [1, 5, "juin"] } as Record<number, [number, number, string]>)[trimester];
    if (new Date() < new Date(Date.UTC(start + yearOffset, month, 1))) throw new ConflictException(`Ce bulletin s'ouvrira le 1er ${label} ${start + yearOffset}. Reviens à ce moment-là !`);
  }
  private checkPeriod(season: string, trimester: number) { if (!SEASON.test(season) || ![1, 2, 3].includes(trimester)) throw new BadRequestException("Période invalide"); }
  async saveSelfEvaluation(user: AuthUser, playerId: string, season: string, trimester: number, dto: SelfEvaluationDto) {
    this.assertWriter(user);
    await this.assertCanRead(user, playerId);
    this.checkPeriod(season, trimester);
    this.checkOpen(season, trimester);
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
    this.checkOpen(season, trimester);
    const e = await this.prisma.selfEvaluation.findUnique({ where: { playerId_season_trimester: { playerId, season, trimester } } });
    if (!e) throw new NotFoundException("Rien à envoyer : remplis d'abord ton bulletin");
    if (e.sentAt) throw new ConflictException("Ce bulletin est déjà envoyé au coach");
    const sent = await this.prisma.selfEvaluation.update({ where: { id: e.id }, data: { sentAt: new Date() } });
    await this.touch(playerId);
    await this.audit.log(user.id, "self-evaluation-sent", "Player", playerId);
    return sent;
  }
  async markSelfEvaluationRead(user: AuthUser, playerId: string, season: string, trimester: number) {
    await this.assertStaffFor(user, playerId);
    this.checkPeriod(season, trimester);
    const e = await this.prisma.selfEvaluation.findUnique({ where: { playerId_season_trimester: { playerId, season, trimester } } });
    if (!e?.sentAt) throw new NotFoundException("Bulletin introuvable");
    return this.prisma.selfEvaluation.update({ where: { id: e.id }, data: { readAt: new Date() } });
  }

  // ----- Étoiles de fin de cours (données par le coach, lues par le joueur et sa famille) -----
  private checkDay(day: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) throw new BadRequestException("Date invalide");
    const t = Date.parse(day), now = Date.now();
    if (t > now + 24 * 3600 * 1000) throw new BadRequestException("Impossible de donner des étoiles pour un cours à venir");
    if (t < now - 366 * 24 * 3600 * 1000) throw new BadRequestException("Cette date est trop ancienne");
  }
  async stars(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    return this.prisma.courseStar.findMany({ where: { playerId }, orderBy: [{ day: "desc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, day: true, stars: true, reason: true, domain: true, goalId: true, comment: true, authorId: true, authorName: true, authorRole: true } }).then((rows) => this.hideAuthors(user, rows));
  }
  async saveStars(user: AuthUser, playerId: string, day: string, dto: StarsDayDto) {
    await this.assertStaffFor(user, playerId);
    this.checkDay(day);
    if (!(await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }))) throw new NotFoundException("Fiche introuvable");
    // Étoiles en plus (bravo) ou en moins (« pas en progrès ») : la raison doit correspondre, et une ligne en moins doit toujours être expliquée au jeune
    for (const i of dto.items) {
      const neg = i.stars < 0;
      if (neg !== STAR_NEG_REASONS.includes(i.reason)) throw new BadRequestException(neg ? "Pour retirer des étoiles, choisis une raison « à travailler »." : "Pour donner des étoiles, choisis une raison positive.");
      if (neg && (i.comment ?? "").trim().length < 3) throw new BadRequestException("Explique en une phrase ce qui n'a pas été : le jeune la verra.");
    }
    // Une ligne peut porter sur une mission du joueur : le domaine du radar est alors celui de la mission
    const goalIds = [...new Set(dto.items.map((i) => i.goalId).filter((g): g is string => !!g))];
    const goals = goalIds.length ? await this.prisma.goal.findMany({ where: { id: { in: goalIds }, playerId }, select: { id: true, axis: true } }) : [];
    if (goals.length !== goalIds.length) throw new BadRequestException("Cette mission n'appartient pas à ce joueur.");
    const axisOf = new Map(goals.map((g) => [g.id, g.axis.toLowerCase()]));
    const who = await this.who(user);
    // Les lignes envoyées remplacent celles de ce cours (le coach peut ainsi en ajouter, corriger ou retirer)
    await this.prisma.$transaction([
      this.prisma.courseStar.deleteMany({ where: { playerId, day } }),
      this.prisma.courseStar.createMany({ data: dto.items.map((i) => ({ ...who, playerId, day, stars: i.stars, reason: i.reason, goalId: i.goalId ?? null, domain: i.goalId ? axisOf.get(i.goalId)! : i.domain!, comment: (i.comment ?? "").trim() })) }),
    ]);
    await this.touch(playerId);
    return this.prisma.courseStar.findMany({ where: { playerId, day }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, day: true, stars: true, reason: true, domain: true, goalId: true, comment: true, authorId: true, authorName: true, authorRole: true } });
  }
  // ----- Les quatre qualités notées à chaque cours (état d'esprit, motivation, assiduité, attitude : de 1 à 5) -----
  async qualities(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    const rows = await this.prisma.courseQuality.findMany({ where: { playerId }, orderBy: { day: "desc" }, select: { id: true, day: true, mindset: true, motivation: true, attendance: true, attitude: true, authorId: true, authorName: true, authorRole: true } });
    return this.hideAuthors(user, rows);
  }
  async saveQualities(user: AuthUser, playerId: string, day: string, dto: QualitiesDto) {
    await this.assertStaffFor(user, playerId);
    this.checkDay(day);
    if (dto.mindset == null && dto.motivation == null && dto.attendance == null && dto.attitude == null) throw new BadRequestException("Note au moins une qualité (de 1 à 5).");
    const data = { mindset: dto.mindset ?? null, motivation: dto.motivation ?? null, attendance: dto.attendance ?? null, attitude: dto.attitude ?? null, ...(await this.who(user)) };
    const r = await this.prisma.courseQuality.upsert({ where: { playerId_day: { playerId, day } }, update: data, create: { playerId, day, ...data }, select: { id: true, day: true, mindset: true, motivation: true, attendance: true, attitude: true, authorId: true, authorName: true, authorRole: true } });
    await this.touch(playerId);
    return r;
  }
  async removeQualities(user: AuthUser, playerId: string, day: string) {
    await this.assertStaffFor(user, playerId);
    this.checkDay(day);
    const r = await this.prisma.courseQuality.deleteMany({ where: { playerId, day } });
    if (!r.count) throw new NotFoundException("Aucune note ce jour-là");
  }
  // Change le nombre d'étoiles d'UNE ligne (ex. en retirer une) sans toucher aux autres lignes du cours
  async updateStarLine(user: AuthUser, playerId: string, lineId: string, dto: StarLineDto) {
    await this.assertStaffFor(user, playerId);
    const line = await this.prisma.courseStar.findFirst({ where: { id: lineId, playerId } });
    if (!line) throw new NotFoundException("Ligne d'étoiles introuvable");
    if (line.stars < 0) throw new BadRequestException("Cette ligne « pas en progrès » se corrige depuis la fiche du joueur, onglet Étoiles.");
    const u = await this.prisma.courseStar.update({ where: { id: lineId }, data: { stars: dto.stars, ...(await this.who(user)) } });
    await this.touch(playerId);
    return { id: u.id, day: u.day, stars: u.stars, reason: u.reason, domain: u.domain, comment: u.comment, authorId: u.authorId, authorName: u.authorName, authorRole: u.authorRole };
  }
  // Retire UNE ligne d'étoiles (les autres lignes du cours restent, avec leur auteur)
  async removeStarLine(user: AuthUser, playerId: string, lineId: string) {
    await this.assertStaffFor(user, playerId);
    const r = await this.prisma.courseStar.deleteMany({ where: { id: lineId, playerId } });
    if (!r.count) throw new NotFoundException("Ligne d'étoiles introuvable");
    await this.touch(playerId);
  }
  async removeStar(user: AuthUser, playerId: string, day: string) {
    await this.assertStaffFor(user, playerId);
    this.checkDay(day);
    const r = await this.prisma.courseStar.deleteMany({ where: { playerId, day } });
    if (!r.count) throw new NotFoundException("Aucune étoile ce jour-là");
  }

  // ----- Matchs déclarés par le jeune (visibles du jeune et du coach, jamais des parents) -----
  private assertYouth(user: AuthUser) { if (user.role !== Role.YOUTH) throw new ForbiddenException("Réservé au jeune"); }
  private async ownMatch(user: AuthUser, playerId: string, matchId: string) {
    const m = await this.prisma.declaredMatch.findFirst({ where: { id: matchId, playerId } });
    if (!m) throw new NotFoundException("Match introuvable");
    return m;
  }
  private editable(m: { createdAt: Date }) { return Date.now() - m.createdAt.getTime() < 7 * 24 * 3600 * 1000; }
  private matchOut(m: { id: string; day: string; kind: string; event: string; result: string; score: string; opponent: string; feeling: number; wellDone: string[]; toImprove: string | null; opponentRanking?: string | null; coachComment: string; createdAt: Date }) {
    return { id: m.id, day: m.day, kind: m.kind, event: m.event, result: m.result, score: m.score, opponent: m.opponent, feeling: m.feeling, wellDone: m.wellDone, toImprove: m.toImprove, opponentRanking: m.opponentRanking ?? null, coachComment: m.coachComment, editableUntil: new Date(m.createdAt.getTime() + 7 * 24 * 3600 * 1000).toISOString(), editable: this.editable(m) };
  }
  async declaredMatches(user: AuthUser, playerId: string) {
    if (!isStaff(user) && user.role !== Role.YOUTH) throw new ForbiddenException("Réservé au jeune et au coach");
    await this.assertCanRead(user, playerId);
    const rows = await this.prisma.declaredMatch.findMany({ where: { playerId }, orderBy: [{ day: "desc" }, { createdAt: "desc" }] });
    return rows.map((m) => this.matchOut(m));
  }
  async addDeclaredMatch(user: AuthUser, playerId: string, dto: DeclaredMatchDto) {
    this.assertYouth(user);
    await this.assertCanRead(user, playerId);
    this.checkDay(dto.day.slice(0, 10));
    if ((await this.prisma.declaredMatch.count({ where: { playerId } })) >= 300) throw new BadRequestException("Trop de matchs enregistrés : parles-en à ton coach.");
    const m = await this.prisma.declaredMatch.create({ data: { playerId, day: dto.day.slice(0, 10), kind: dto.kind, event: (dto.event ?? "").trim(), result: dto.result, score: (dto.score ?? "").trim(), opponent: dto.opponent, feeling: dto.feeling, wellDone: [...new Set(dto.wellDone ?? [])], toImprove: dto.toImprove ?? null, opponentRanking: dto.opponentRanking ?? null } });
    await this.touch(playerId);
    return this.matchOut(m);
  }
  async updateDeclaredMatch(user: AuthUser, playerId: string, matchId: string, dto: DeclaredMatchDto) {
    this.assertYouth(user);
    await this.assertCanRead(user, playerId);
    const m = await this.ownMatch(user, playerId, matchId);
    if (!this.editable(m)) throw new ConflictException("Ce match ne peut plus être modifié (au-delà de 7 jours).");
    this.checkDay(dto.day.slice(0, 10));
    const u = await this.prisma.declaredMatch.update({ where: { id: matchId }, data: { day: dto.day.slice(0, 10), kind: dto.kind, event: (dto.event ?? "").trim(), result: dto.result, score: (dto.score ?? "").trim(), opponent: dto.opponent, feeling: dto.feeling, wellDone: [...new Set(dto.wellDone ?? [])], toImprove: dto.toImprove ?? null, opponentRanking: dto.opponentRanking ?? null } });
    return this.matchOut(u);
  }
  async removeDeclaredMatch(user: AuthUser, playerId: string, matchId: string) {
    if (!isStaff(user) && user.role !== Role.YOUTH) throw new ForbiddenException("Réservé au jeune et au coach");
    await this.assertCanRead(user, playerId);
    const m = await this.ownMatch(user, playerId, matchId);
    if (user.role === Role.YOUTH && !this.editable(m)) throw new ConflictException("Ce match ne peut plus être supprimé (au-delà de 7 jours) : demande à ton coach.");
    await this.prisma.declaredMatch.delete({ where: { id: matchId } });
  }
  async commentDeclaredMatch(user: AuthUser, playerId: string, matchId: string, dto: MatchCommentDto) {
    await this.assertStaffFor(user, playerId);
    await this.ownMatch(user, playerId, matchId);
    const u = await this.prisma.declaredMatch.update({ where: { id: matchId }, data: { coachComment: dto.comment.trim() } });
    return this.matchOut(u);
  }

  // ----- Matchs -----
  async matches(user: AuthUser, playerId: string) {
    await this.assertCanRead(user, playerId);
    return this.hideAuthors(user, await this.prisma.match.findMany({ where: { playerId }, orderBy: { date: "desc" } }));
  }
  async addMatch(user: AuthUser, playerId: string, dto: MatchDto) {
    await this.assertStaffFor(user, playerId);
    const m = await this.prisma.match.create({ data: { ...(await this.who(user)), playerId, date: new Date(dto.date), tournament: dto.tournament, round: dto.round ?? "", result: dto.result, score: dto.score ?? "", remark: dto.remark ?? "", opponentRanking: dto.opponentRanking ?? null } }).catch(() => { throw new NotFoundException("Fiche introuvable"); });
    await this.touch(playerId);
    return m;
  }
  async removeMatch(user: AuthUser, matchId: string) {
    const m = await this.prisma.match.findUnique({ where: { id: matchId }, select: { playerId: true } });
    if (!m) throw new NotFoundException("Match introuvable");
    await this.assertStaffFor(user, m.playerId);
    await this.prisma.match.delete({ where: { id: matchId } }).catch(() => { throw new NotFoundException("Match introuvable"); });
  }
}
