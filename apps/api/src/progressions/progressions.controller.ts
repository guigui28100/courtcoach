import { Body, Controller, Delete, Get, HttpCode, Put } from "@nestjs/common";
import { Role } from "@prisma/client";
import { IsObject } from "class-validator";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { ProgressionsService } from "./progressions.service";

class ProgressionDto { @IsObject() data!: Record<string, unknown>; }

// Progression des séances : le prof (coach ou entraîneur) ne voit et ne modifie QUE la sienne. Président, bureau, adultes, familles et jeunes : 403.
@Roles(Role.COACH, Role.TRAINER)
@Controller("progressions")
export class ProgressionsController {
  constructor(private readonly svc: ProgressionsService) {}
  @Get() get(@CurrentUser() u: AuthUser) { return this.svc.get(u.id); }
  @Put() @HttpCode(200) set(@CurrentUser() u: AuthUser, @Body() dto: ProgressionDto) { return this.svc.set(u.id, dto.data); }
  @Delete() @HttpCode(204) remove(@CurrentUser() u: AuthUser) { return this.svc.remove(u.id); }
}
