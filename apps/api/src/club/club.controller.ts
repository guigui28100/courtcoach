import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators";
import { ClubEventDto, PeopleDto, TeamCountsDto } from "./club.dto";
import { ClubService } from "./club.service";

// Planning du club : réservé au coach (aucun accès pour les entraîneurs, les adultes ni les familles)
@Roles(Role.COACH)
@Controller("club")
export class ClubController {
  constructor(private readonly svc: ClubService) {}
  @Get("plan") plan() { return this.svc.plan(); }
  @Put("teams") @HttpCode(200) teams(@Body() dto: TeamCountsDto) { return this.svc.setTeams(dto.counts); }
  @Put("people") @HttpCode(200) people(@Body() dto: PeopleDto) { return this.svc.setPeople(dto.people); }
  @Post("events") create(@Body() dto: ClubEventDto) { return this.svc.create(dto); }
  @Put("events/:id") @HttpCode(200) update(@Param("id") id: string, @Body() dto: ClubEventDto) { return this.svc.update(id, dto); }
  @Delete("events/:id") remove(@Param("id") id: string) { return this.svc.remove(id); }
}
