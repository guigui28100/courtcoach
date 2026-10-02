import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, ParseIntPipe } from "@nestjs/common";
import { AuthUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators";
import { ConsentDto, CreatePlayerDto, EvaluationDto, GoalDto, InvitationDto, MatchDto, UpdateGoalDto, UpdatePlayerDto } from "./dto";
import { PlayersService } from "./players.service";

@Controller()
export class PlayersController {
  constructor(private readonly svc: PlayersService) {}

  @Get("players") list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Get("players/inactive") inactive(@CurrentUser() u: AuthUser) { return this.svc.inactive(u); }
  @Post("players") create(@CurrentUser() u: AuthUser, @Body() dto: CreatePlayerDto) { return this.svc.create(u, dto); }
  @Get("players/:id") get(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.get(u, id); }
  @Patch("players/:id") update(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: UpdatePlayerDto) { return this.svc.update(u, id, dto); }
  @Delete("players/:id") @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
  @Get("players/:id/export") export(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.export(u, id); }

  @Post("players/:id/consents") addConsent(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: ConsentDto) { return this.svc.addConsent(u, id, dto); }
  @Post("players/:id/consents/:consentId/withdraw") @HttpCode(204) withdraw(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("consentId") cid: string) { return this.svc.withdrawConsent(u, id, cid); }
  @Post("players/:id/invitations") invite(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: InvitationDto) { return this.svc.invite(u, id, dto); }

  @Post("players/:id/access") createAccess(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: InvitationDto) { return this.svc.createAccess(u, id, dto); }

  @Get("players/:id/access") listAccess(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.listAccess(u, id); }
  @Delete("players/:id/access/:userId") @HttpCode(204) revokeAccess(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("userId") uid: string) { return this.svc.revokeAccess(u, id, uid); }

  @Get("players/:id/goals") goals(@CurrentUser() u: AuthUser, @Param("id") id: string, @Query("season") season?: string) { return this.svc.goals(u, id, season); }
  @Post("players/:id/goals") addGoal(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: GoalDto) { return this.svc.addGoal(u, id, dto); }
  @Patch("goals/:goalId") updateGoal(@CurrentUser() u: AuthUser, @Param("goalId") gid: string, @Body() dto: UpdateGoalDto) { return this.svc.updateGoal(u, gid, dto); }
  @Delete("goals/:goalId") @HttpCode(204) removeGoal(@CurrentUser() u: AuthUser, @Param("goalId") gid: string) { return this.svc.removeGoal(u, gid); }

  @Get("players/:id/evaluations") evaluations(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.evaluations(u, id); }
  @Put("players/:id/evaluations/:season/:trimester") saveEvaluation(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("season") season: string, @Param("trimester", ParseIntPipe) t: number, @Body() dto: EvaluationDto) { return this.svc.saveEvaluation(u, id, season, t, dto); }

  @Get("players/:id/matches") matches(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.matches(u, id); }
  @Post("players/:id/matches") addMatch(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: MatchDto) { return this.svc.addMatch(u, id, dto); }
  @Delete("matches/:matchId") @HttpCode(204) removeMatch(@CurrentUser() u: AuthUser, @Param("matchId") mid: string) { return this.svc.removeMatch(u, mid); }
}
