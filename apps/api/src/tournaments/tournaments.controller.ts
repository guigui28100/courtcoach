import { Controller, Delete, Get, HttpCode, Param, Post, Query, Req, Res } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { Request, Response } from "express";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { TournamentsService } from "./tournaments.service";

// Programmations de tournoi : jamais ouvertes aux adhérents adultes (demande de coaching).
@Roles(Role.COACH, Role.TRAINER, Role.GUARDIAN, Role.YOUTH)
@Controller()
export class TournamentsController {
  constructor(private readonly svc: TournamentsService) {}

  @Get("tournaments") list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Roles(Role.COACH, Role.TRAINER) @Post("tournaments")
  create(@CurrentUser() u: AuthUser, @Query("title") title: string, @Query("fileName") fileName: string, @Query("playerIds") playerIds: string | undefined, @Query("shared") shared: string | undefined, @Req() req: Request) {
    return this.svc.create(u, { title, fileName, playerIds: (playerIds ?? "").split(",").map((x) => x.trim()), shared: shared === "1" }, req.body);
  }
  @Get("tournaments/:id/file")
  async file(@CurrentUser() u: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const r = await this.svc.file(u, id);
    res.status(200).set({
      "Content-Type": r.mime, "Content-Length": String(r.data.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox", // un document ouvert dans le navigateur ne peut exécuter aucun script
      "Content-Disposition": `${r.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.name)}`,
    }).end(r.data);
  }
  @Roles(Role.COACH, Role.TRAINER) @Delete("tournaments/:id") @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
}
