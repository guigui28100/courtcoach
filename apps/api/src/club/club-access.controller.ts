import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { ClubInvitationDto } from "./club-access.dto";
import { ClubAccessService } from "./club-access.service";

// Accès du club : réservé au coach (ni président, ni bureau, ni entraîneur, ni adulte, ni famille)
@Roles(Role.COACH)
@Controller("club-access")
export class ClubAccessController {
  constructor(private readonly svc: ClubAccessService) {}
  @Get() list() { return this.svc.list(); }
  @Post("invitations") invite(@CurrentUser() u: AuthUser, @Body() dto: ClubInvitationDto) { return this.svc.invite(u, dto); }
  @Delete("invitations/:id") @HttpCode(204) cancel(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.cancelInvitation(u, id); }
  @Delete("users/:id") @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
}
