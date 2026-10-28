import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { ClubEventDto, PeopleDto, ScheduleDto, ReorderDto, TeamCountsDto } from "./club.dto";
import { ClubService } from "./club.service";

// Planning du club : le coach et le président le gèrent ; les membres du bureau le VOIENT seulement (lecture) ; aucun accès pour les entraîneurs, les adultes ni les familles
@Roles(Role.COACH, Role.PRESIDENT)
@Controller("club")
export class ClubController {
  constructor(private readonly svc: ClubService) {}
  @Roles(Role.COACH, Role.PRESIDENT, Role.BUREAU) @Get("plan") plan() { return this.svc.plan(); }
  // « Mes événements » : chaque personne du site (coach, entraîneur, président) ne voit que les événements où son nom est coché dans « Qui s'en occupe ? »
  @Roles(Role.COACH, Role.PRESIDENT, Role.TRAINER) @Get("mine") mine(@CurrentUser() u: AuthUser) { return this.svc.mine(u.id); }
  // Jours de cours habituels (jour + horaires) : chacun LIT les siens, mais seul le coach les place, pour lui-même ou pour un entraîneur
  @Roles(Role.COACH, Role.PRESIDENT, Role.TRAINER) @Get("my-schedule") mySchedule(@CurrentUser() u: AuthUser) { return this.svc.mySchedule(u.id); }
  @Roles(Role.COACH) @Get("schedule/:userId") scheduleOf(@Param("userId") id: string) { return this.svc.scheduleOf(id); }
  @Roles(Role.COACH) @Put("schedule/:userId") @HttpCode(200) setSchedule(@Param("userId") id: string, @Body() dto: ScheduleDto) { return this.svc.setSchedule(id, dto.items); }
  @Put("teams") @HttpCode(200) teams(@Body() dto: TeamCountsDto) { return this.svc.setTeams(dto.counts); }
  @Put("people") @HttpCode(200) people(@Body() dto: PeopleDto) { return this.svc.setPeople(dto.people); }
  @Put("events-order") @HttpCode(200) reorder(@Body() dto: ReorderDto) { return this.svc.reorder(dto.ids); }
  @Post("events") create(@Body() dto: ClubEventDto) { return this.svc.create(dto); }
  @Put("events/:id") @HttpCode(200) update(@Param("id") id: string, @Body() dto: ClubEventDto) { return this.svc.update(id, dto); }
  @Delete("events/:id") remove(@Param("id") id: string) { return this.svc.remove(id); }
}
