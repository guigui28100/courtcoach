import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { AuthUser } from "../common/auth.types";
import { Role } from "@prisma/client";
import { CurrentUser, Roles } from "../common/decorators";
import { AnswerLessonDto, CreateLessonDto, RespondLessonDto } from "./lessons.dto";
import { LessonsService } from "./lessons.service";

// Les demandes de cours : adultes, coach, et professeurs de cours particuliers (seulement SES demandes). Ni familles, ni entraîneurs de comité ou de club.
@Roles(Role.COACH, Role.ADULT, Role.TRAINER)
@Controller("lessons")
export class LessonsController {
  constructor(private readonly svc: LessonsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Roles(Role.ADULT) @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateLessonDto) { return this.svc.create(u, dto); }
  @Post(":id/answer") @HttpCode(200) answer(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: AnswerLessonDto) { return this.svc.answer(u, id, dto); }
  @Post(":id/confirm") @HttpCode(200) confirm(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.confirm(u, id); }
  @Roles(Role.ADULT) @Post(":id/respond") @HttpCode(200) respond(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: RespondLessonDto) { return this.svc.respond(u, id, dto); }
  @Roles(Role.ADULT) @Post(":id/cancel") @HttpCode(200) cancel(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.cancel(u, id); }
  @Roles(Role.ADULT) @Post(":id/seen") @HttpCode(204) seen(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.markSeen(u, id); }
}
