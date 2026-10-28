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
  // Mes jours de cours habituels (jour + horaires) : chacun écrit les siens, personne d'autre ne les modifie
  @Roles(Role.COACH, Role.PRESIDENT, Role.TRAINER) @Get("my-schedule") mySchedule(@CurrentUser() u: AuthUser) { return this.svc.mySchedule(u.id); }
  @Roles(Role.COACH, Role.PRESIDENT, Role.TRAINER) @Put("my-schedule") @HttpCode(200) setMySchedule(@CurrentUser() u: AuthUser, @Body() dto: ScheduleDto) { return this.svc.setMySchedule(u.id, dto.items); }
  @Put("teams") @HttpCode(200) teams(@Body() dto: TeamCountsDto) { return this.svc.setTeams(dto.counts); }
  @Put("people") @HttpCode(200) people(@Body() dto: PeopleDto) { return this.svc.setPeople(dto.people); }
  @Put("events-order") @HttpCode(200) reorder(@Body() dto: ReorderDto) { return this.svc.reorder(dto.ids); }
  @Post("events") create(@Body() dto: ClubEventDto) { return this.svc.create(dto); }
  @Put("events/:id") @HttpCode(200) update(@Param("id") id: string, @Body() dto: ClubEventDto) { return this.svc.update(id, dto); }
  @Delete("events/:id") remove(@Param("id") id: string) { return this.svc.remove(id); }
}
