import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, ParseIntPipe } from "@nestjs/common";
import { AuthUser } from "../common/auth.types";
import { Role } from "@prisma/client";
import { CurrentUser, Roles } from "../common/decorators";
import { CheckpointDto, ConsentDto, CreatePlayerDto, EvaluationDto, GoalDto, InvitationDto, DeclaredMatchDto, MatchCommentDto, MatchDto, SelfEvaluationDto, StarsDayDto, StarLineDto, QualitiesDto, FamilyInfoDto, GoalTemplateDto, SignatureDto, UpdateGoalDto, UpdatePlayerDto } from "./dto";
import { PlayersService } from "./players.service";

// Tout le Centre de compétition jeunes est fermé aux adhérents adultes (demande de coaching) : seuls le coach et les familles invitées entrent.
@Roles(Role.COACH, Role.TRAINER, Role.GUARDIAN, Role.YOUTH)
@Controller()
export class PlayersController {
  constructor(private readonly svc: PlayersService) {}

  @Get("players") list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Get("players/inactive") inactive(@CurrentUser() u: AuthUser) { return this.svc.inactive(u); }
  @Post("players") create(@CurrentUser() u: AuthUser, @Body() dto: CreatePlayerDto) { return this.svc.create(u, dto); }
  @Get("players/:id") get(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.get(u, id); }
  @Roles(Role.GUARDIAN) @Put("players/:id/renseignements") familyInfo(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: FamilyInfoDto) { return this.svc.updateFamilyInfo(u, id, dto); }
  // Signature du coach, en bas des bulletins : écriture réservée au coach ; lecture par ceux qui ont accès à la fiche
  @Roles(Role.COACH) @Put("signature") setSignature(@CurrentUser() u: AuthUser, @Body() dto: SignatureDto) { return this.svc.setSignature(u, dto.image); }
  @Roles(Role.COACH) @Delete("signature") @HttpCode(204) clearSignature(@CurrentUser() u: AuthUser) { return this.svc.clearSignature(u); }
  @Roles(Role.COACH) @Get("signature") mySignature(@CurrentUser() u: AuthUser) { return this.svc.mySignature(u); }
  @Get("players/:id/signature") signature(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.signatureFor(u, id); }
  @Patch("players/:id") update(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: UpdatePlayerDto) { return this.svc.update(u, id, dto); }
  @Delete("players/:id") @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
  @Get("players/:id/export") export(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.export(u, id); }

  @Post("players/:id/consents") addConsent(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: ConsentDto) { return this.svc.addConsent(u, id, dto); }
  @Post("players/:id/consents/:consentId/withdraw") @HttpCode(204) withdraw(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("consentId") cid: string) { return this.svc.withdrawConsent(u, id, cid); }
  @Post("players/:id/invitations") invite(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: InvitationDto) { return this.svc.invite(u, id, dto); }

  @Post("players/:id/access") createAccess(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: InvitationDto) { return this.svc.createAccess(u, id, dto); }

  @Get("players/:id/access") listAccess(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.listAccess(u, id); }
  @Delete("players/:id/access/:userId") @HttpCode(204) revokeAccess(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("userId") uid: string) { return this.svc.revokeAccess(u, id, uid); }

  @Post("players/:id/access/:userId/reset-password") @HttpCode(200) resetPassword(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("userId") uid: string) { return this.svc.resetPassword(u, id, uid); }

  // Bibliothèque d'objectifs « modèles » : lue par le coach et les entraîneurs, gérée par le coach seul
  @Roles(Role.COACH, Role.TRAINER) @Get("goal-templates") templates() { return this.svc.templates(); }
  @Roles(Role.COACH) @Post("goal-templates") addTemplate(@CurrentUser() u: AuthUser, @Body() dto: GoalTemplateDto) { return this.svc.addTemplate(u, dto); }
  @Roles(Role.COACH) @Patch("goal-templates/:tid") updateTemplate(@Param("tid") tid: string, @Body() dto: GoalTemplateDto) { return this.svc.updateTemplate(tid, dto); }
  @Roles(Role.COACH) @Delete("goal-templates/:tid") @HttpCode(204) removeTemplate(@Param("tid") tid: string) { return this.svc.removeTemplate(tid); }
  @Get("players/:id/goals") goals(@CurrentUser() u: AuthUser, @Param("id") id: string, @Query("season") season?: string) { return this.svc.goals(u, id, season); }
  @Post("players/:id/goals") addGoal(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: GoalDto) { return this.svc.addGoal(u, id, dto); }
  @Patch("goals/:goalId") updateGoal(@CurrentUser() u: AuthUser, @Param("goalId") gid: string, @Body() dto: UpdateGoalDto) { return this.svc.updateGoal(u, gid, dto); }
  @Put("goals/:goalId/checkpoints/:trimester") saveCheckpoint(@CurrentUser() u: AuthUser, @Param("goalId") gid: string, @Param("trimester", ParseIntPipe) t: number, @Body() dto: CheckpointDto) { return this.svc.saveCheckpoint(u, gid, t, dto); }
  @Delete("goals/:goalId") @HttpCode(204) removeGoal(@CurrentUser() u: AuthUser, @Param("goalId") gid: string) { return this.svc.removeGoal(u, gid); }

  @Get("players/:id/evaluations") evaluations(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.evaluations(u, id); }
  @Put("players/:id/evaluations/:season/:trimester") saveEvaluation(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("season") season: string, @Param("trimester", ParseIntPipe) t: number, @Body() dto: EvaluationDto) { return this.svc.saveEvaluation(u, id, season, t, dto); }

  @Get("players/:id/self-evaluations") selfEvaluations(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.selfEvaluations(u, id); }
  @Roles(Role.GUARDIAN, Role.YOUTH) @Put("players/:id/self-evaluations/:season/:trimester") saveSelfEvaluation(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("season") season: string, @Param("trimester", ParseIntPipe) t: number, @Body() dto: SelfEvaluationDto) { return this.svc.saveSelfEvaluation(u, id, season, t, dto); }
  @Roles(Role.GUARDIAN, Role.YOUTH) @Post("players/:id/self-evaluations/:season/:trimester/send") sendSelfEvaluation(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("season") season: string, @Param("trimester", ParseIntPipe) t: number) { return this.svc.sendSelfEvaluation(u, id, season, t); }
  @Roles(Role.COACH, Role.TRAINER) @Post("players/:id/self-evaluations/:season/:trimester/read") readSelfEvaluation(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("season") season: string, @Param("trimester", ParseIntPipe) t: number) { return this.svc.markSelfEvaluationRead(u, id, season, t); }

  @Get("players/:id/stars") stars(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.stars(u, id); }
  @Roles(Role.COACH, Role.TRAINER) @Put("players/:id/stars/:day") saveStar(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("day") day: string, @Body() dto: StarsDayDto) { return this.svc.saveStars(u, id, day, dto); }
  @Roles(Role.COACH, Role.TRAINER) @Patch("players/:id/stars/line/:lineId") updateStarLine(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("lineId") lid: string, @Body() dto: StarLineDto) { return this.svc.updateStarLine(u, id, lid, dto); }
  @Roles(Role.COACH, Role.TRAINER) @Delete("players/:id/stars/line/:lineId") @HttpCode(204) removeStarLine(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("lineId") lid: string) { return this.svc.removeStarLine(u, id, lid); }
  @Roles(Role.COACH, Role.TRAINER) @Delete("players/:id/stars/:day") @HttpCode(204) removeStar(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("day") day: string) { return this.svc.removeStar(u, id, day); }

  @Get("players/:id/qualities") qualities(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.qualities(u, id); }
  @Roles(Role.COACH, Role.TRAINER) @Put("players/:id/qualities/:day") saveQualities(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("day") day: string, @Body() dto: QualitiesDto) { return this.svc.saveQualities(u, id, day, dto); }
  @Roles(Role.COACH, Role.TRAINER) @Delete("players/:id/qualities/:day") @HttpCode(204) removeQualities(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("day") day: string) { return this.svc.removeQualities(u, id, day); }

  @Get("players/:id/declared-matches") declaredMatches(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.declaredMatches(u, id); }
  @Roles(Role.YOUTH) @Post("players/:id/declared-matches") addDeclaredMatch(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: DeclaredMatchDto) { return this.svc.addDeclaredMatch(u, id, dto); }
  @Roles(Role.YOUTH) @Put("players/:id/declared-matches/:matchId") updateDeclaredMatch(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("matchId") mid: string, @Body() dto: DeclaredMatchDto) { return this.svc.updateDeclaredMatch(u, id, mid, dto); }
  @Roles(Role.COACH, Role.TRAINER, Role.YOUTH) @Delete("players/:id/declared-matches/:matchId") @HttpCode(204) removeDeclaredMatch(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("matchId") mid: string) { return this.svc.removeDeclaredMatch(u, id, mid); }
  @Roles(Role.COACH, Role.TRAINER) @Put("players/:id/declared-matches/:matchId/comment") commentDeclaredMatch(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("matchId") mid: string, @Body() dto: MatchCommentDto) { return this.svc.commentDeclaredMatch(u, id, mid, dto); }

  @Get("players/:id/matches") matches(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.matches(u, id); }
  @Post("players/:id/matches") addMatch(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: MatchDto) { return this.svc.addMatch(u, id, dto); }
  @Delete("matches/:matchId") @HttpCode(204) removeMatch(@CurrentUser() u: AuthUser, @Param("matchId") mid: string) { return this.svc.removeMatch(u, mid); }
}
