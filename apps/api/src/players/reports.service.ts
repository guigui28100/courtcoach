import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, isStaff } from "../common/auth.types";
import { TournamentReportDto } from "./dto";
import { PlayersService } from "./players.service";
import { REPORT_LEVELS, REPORT_THEMES } from "./report-themes";

const isRealDay = (d: string) => { const t = new Date(d + "T00:00:00Z"); return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d; };
type Themes = Record<string, { level: string; goalId?: string }>;

// Bilan de tournoi : saisi par l'entraîneur de comité (ses jeunes seulement) ou le coach, VALIDÉ par le coach.
// Avant la validation : invisible du jeune et de sa famille, aucun match créé, aucune étoile donnée.
@Injectable()
export class TournamentReportsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly players: PlayersService) {}

  private async who(user: AuthUser) {
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true } });
    return { authorId: user.id, authorName: u?.firstName || (user.role === Role.COACH ? "Coach" : "Entraîneur"), authorRole: user.role as string };
  }

  // Vérifie les dates et les thèmes ; renvoie les thèmes nettoyés (seuls les thèmes connus, niveaux connus, missions DU joueur)
  private async clean(playerId: string, dto: TournamentReportDto) {
    if (!isRealDay(dto.dateFrom) || !isRealDay(dto.dateTo)) throw new BadRequestException("Date de tournoi invalide.");
    if (dto.dateFrom > dto.dateTo) throw new BadRequestException("La date de fin ne peut pas être avant la date de début.");
    const soon = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (dto.dateTo > soon) throw new BadRequestException("Le tournoi ne peut pas être dans le futur.");
    if (dto.dateTo < "2020-01-01" || dto.dateFrom < "2020-01-01") throw new BadRequestException("Date de tournoi invalide.");
    for (const m of dto.matches) if (!isRealDay(m.day)) throw new BadRequestException("Date de match invalide.");
    const known = new Set(REPORT_THEMES.map((t) => t.key));
    const themes: Themes = {};
    for (const [k, v] of Object.entries(dto.themes ?? {})) {
      if (!known.has(k)) throw new BadRequestException("Thème inconnu.");
      if (!v || typeof v !== "object" || !(v.level in REPORT_LEVELS)) throw new BadRequestException("Niveau inconnu pour un thème.");
      themes[k] = v.goalId && typeof v.goalId === "string" ? { level: v.level, goalId: v.goalId.slice(0, 40) } : { level: v.level };
    }
    if (!Object.keys(themes).length) throw new BadRequestException("Choisis au moins un thème (bien, très bien ou à travailler).");
    const goalIds = [...new Set(Object.values(themes).map((t) => t.goalId).filter((g): g is string => !!g))];
    if (goalIds.length && (await this.prisma.goal.count({ where: { id: { in: goalIds }, playerId } })) !== goalIds.length) throw new BadRequestException("Cette mission n'appartient pas à ce joueur.");
    return themes;
  }
  private data(dto: TournamentReportDto, themes: Themes) {
    return { name: dto.name, dateFrom: dto.dateFrom, dateTo: dto.dateTo, feeling: dto.feeling, matches: dto.matches.map((m) => ({ day: m.day, round: m.round ?? "", result: m.result, score: m.score ?? "", opponentRanking: m.opponentRanking ?? null })), themes, summary: (dto.summary ?? "").trim() };
  }

  // Le personnel voit tout (l'entraîneur : ses jeunes seulement) ; la famille et le jeune : UNIQUEMENT les bilans validés, sans le nom de l'auteur
  async list(user: AuthUser, playerId: string) {
    await this.players.assertCanRead(user, playerId);
    const rows = await this.prisma.tournamentReport.findMany({ where: isStaff(user) ? { playerId } : { playerId, status: "VALIDATED" }, orderBy: [{ dateTo: "desc" }, { createdAt: "desc" }] });
    if (isStaff(user)) return rows;
    return rows.map(({ authorId, authorName, authorRole, validatedById, ...r }) => r);
  }
  async pending(user: AuthUser) {
    this.players.assertCoach(user);
    return this.prisma.tournamentReport.findMany({ where: { status: "SUBMITTED" }, orderBy: { createdAt: "asc" }, include: { player: { select: { id: true, firstName: true, lastName: true } } } });
  }

  async create(user: AuthUser, playerId: string, dto: TournamentReportDto) {
    await this.players.assertStaffFor(user, playerId);
    const themes = await this.clean(playerId, dto);
    const r = await this.prisma.tournamentReport.create({ data: { playerId, ...(await this.who(user)), ...this.data(dto, themes), status: "SUBMITTED" } });
    await this.audit.log(user.id, "report-create", "TournamentReport", r.id);
    return r;
  }

  private async own(user: AuthUser, playerId: string, rid: string) {
    await this.players.assertStaffFor(user, playerId);
    const r = await this.prisma.tournamentReport.findFirst({ where: { id: rid, playerId } });
    if (!r || (user.role === Role.TRAINER && r.authorId !== user.id)) throw new NotFoundException("Bilan introuvable"); // un entraîneur ne touche qu'à SES bilans
    return r;
  }
  async update(user: AuthUser, playerId: string, rid: string, dto: TournamentReportDto) {
    const r = await this.own(user, playerId, rid);
    if (r.status === "VALIDATED") throw new BadRequestException("Ce bilan est déjà validé : il ne peut plus être modifié.");
    const themes = await this.clean(playerId, dto);
    return this.prisma.tournamentReport.update({ where: { id: r.id }, data: this.data(dto, themes) });
  }

  // Validation par le coach : le bilan devient visible, les matchs entrent dans le bulletin, les étoiles « en match » (×2) sont données
  async validate(user: AuthUser, playerId: string, rid: string) {
    this.players.assertCoach(user);
    const r = await this.own(user, playerId, rid);
    if (r.status === "VALIDATED") throw new BadRequestException("Ce bilan est déjà validé.");
    const themes = r.themes as Themes;
    const goalIds = [...new Set(Object.values(themes).map((t) => t.goalId).filter((g): g is string => !!g))];
    const goals = goalIds.length ? await this.prisma.goal.findMany({ where: { id: { in: goalIds }, playerId }, select: { id: true } }) : [];
    const goalOk = new Set(goals.map((g) => g.id)); // une mission supprimée entre-temps : l'étoile devient « hors mission »
    const author = { authorId: r.authorId, authorName: r.authorName, authorRole: r.authorRole };
    const stars = REPORT_THEMES.filter((t) => themes[t.key] && REPORT_LEVELS[themes[t.key].level] > 0).map((t) => ({
      ...author, playerId, day: r.dateTo, stars: REPORT_LEVELS[themes[t.key].level], reason: "progres", domain: t.axis, goalId: themes[t.key].goalId && goalOk.has(themes[t.key].goalId!) ? themes[t.key].goalId! : null,
      comment: `Bilan du tournoi : ${r.name}`.slice(0, 300), reportId: r.id,
    }));
    const matches = (r.matches as any[]).map((m) => ({ ...author, playerId, date: new Date(m.day + "T12:00:00Z"), tournament: r.name, round: m.round ?? "", result: m.result, score: m.score ?? "", remark: "", opponentRanking: m.opponentRanking ?? null, reportId: r.id }));
    await this.prisma.$transaction([
      this.prisma.match.createMany({ data: matches }),
      ...(stars.length ? [this.prisma.courseStar.createMany({ data: stars })] : []),
      this.prisma.tournamentReport.update({ where: { id: r.id }, data: { status: "VALIDATED", validatedAt: new Date(), validatedById: user.id } }),
      this.prisma.player.update({ where: { id: playerId }, data: { lastActivityAt: new Date() } }),
    ]);
    await this.audit.log(user.id, "report-validate", "TournamentReport", r.id);
    return this.prisma.tournamentReport.findUnique({ where: { id: r.id } });
  }

  // Suppression : le coach peut tout supprimer (les matchs et étoiles du bilan validé partent avec) ; l'entraîneur seulement SES bilans pas encore validés
  async remove(user: AuthUser, playerId: string, rid: string) {
    const r = await this.own(user, playerId, rid);
    if (r.status === "VALIDATED" && user.role !== Role.COACH) throw new NotFoundException("Bilan introuvable");
    await this.prisma.$transaction([
      this.prisma.match.deleteMany({ where: { reportId: r.id } }),
      this.prisma.courseStar.deleteMany({ where: { reportId: r.id } }),
      this.prisma.tournamentReport.delete({ where: { id: r.id } }),
    ]);
    await this.audit.log(user.id, "report-delete", "TournamentReport", r.id);
  }
}
