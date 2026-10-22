import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { Request, Response } from "express";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { ApproveDto, kindOf, ProfProfileDto, SlotsDto } from "./profs.dto";
import { ProfsService } from "./profs.service";

@Controller("profs")
export class ProfsController {
  constructor(private readonly svc: ProfsService) {}

  // Liste des professeurs visibles : adultes (pour choisir) et coach
  @Roles(Role.ADULT, Role.COACH, Role.PRESIDENT) @Get() list(@CurrentUser() u: AuthUser) { return this.svc.listVisible(u); }

  // Planning d'un professeur : créneaux d'une heure, libres ou pris
  @Roles(Role.ADULT, Role.COACH, Role.PRESIDENT) @Get(":id/planning") planning(@Param("id") id: string) { return this.svc.planning(id); }

  // Espace du professeur (entraîneur qui a cliqué « je souhaite donner des cours particuliers » : vérifié dans le service)
  @Roles(Role.TRAINER, Role.COACH) @Get("me") me(@CurrentUser() u: AuthUser) { return this.svc.me(u); }
  @Roles(Role.TRAINER, Role.COACH) @Post("me/optin") @HttpCode(200) optIn(@CurrentUser() u: AuthUser) { return this.svc.optIn(u); }
  @Roles(Role.TRAINER, Role.COACH) @Delete("me") optOut(@CurrentUser() u: AuthUser) { return this.svc.optOut(u); }
  @Roles(Role.TRAINER, Role.COACH) @Put("me") update(@CurrentUser() u: AuthUser, @Body() dto: ProfProfileDto) { return this.svc.updateMe(u, dto); }
  @Roles(Role.TRAINER, Role.COACH) @Put("me/slots") slots(@CurrentUser() u: AuthUser, @Body() dto: SlotsDto) { return this.svc.setSlots(u, dto.slots); }
  @Roles(Role.TRAINER, Role.COACH) @Put("me/documents/:kind")
  putDocument(@CurrentUser() u: AuthUser, @Param("kind") kind: string, @Query("fileName") fileName: string, @Query("validUntil") validUntil: string | undefined, @Req() req: Request) {
    return this.svc.putDocument(u, kindOf(kind), { fileName, validUntil }, req.body);
  }
  @Roles(Role.TRAINER, Role.COACH) @Delete("me/documents/:kind") removeDocument(@CurrentUser() u: AuthUser, @Param("kind") kind: string) { return this.svc.deleteDocument(u, kindOf(kind)); }

  // Coach : tous les professeurs, leurs documents, validation
  @Roles(Role.COACH, Role.PRESIDENT) @Get("admin") adminList() { return this.svc.adminList(); }
  @Roles(Role.COACH, Role.PRESIDENT) @Post(":id/approval") @HttpCode(200) approve(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: ApproveDto) { return this.svc.approve(u, id, dto.approved); }

  // Document : le coach, ou le professeur pour SES propres documents
  @Roles(Role.COACH, Role.PRESIDENT, Role.TRAINER) @Get(":id/documents/:kind")
  async file(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("kind") kind: string, @Res() res: Response) {
    const r = await this.svc.file(u, id, kindOf(kind));
    res.status(200).set({
      "Content-Type": r.mime, "Content-Length": String(r.data.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(r.name)}`,
    }).end(r.data);
  }
}
