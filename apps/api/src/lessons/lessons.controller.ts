import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { AuthUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators";
import { AnswerLessonDto, CreateLessonDto } from "./lessons.dto";
import { LessonsService } from "./lessons.service";

@Controller("lessons")
export class LessonsController {
  constructor(private readonly svc: LessonsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateLessonDto) { return this.svc.create(u, dto); }
  @Post(":id/answer") @HttpCode(200) answer(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: AnswerLessonDto) { return this.svc.answer(u, id, dto); }
  @Post(":id/seen") @HttpCode(204) seen(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.markSeen(u, id); }
}
