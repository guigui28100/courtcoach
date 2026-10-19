import { Controller, Get } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { DashboardService } from "./dashboard.service";

@Roles(Role.COACH, Role.TRAINER)
@Controller()
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}
  @Get("dashboard") get(@CurrentUser() u: AuthUser) { return this.svc.get(u); }
}
