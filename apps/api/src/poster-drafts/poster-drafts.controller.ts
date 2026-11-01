import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, Res } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { Request, Response } from "express";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { CreateDraftDto, UpdateDraftDto } from "./poster-drafts.dto";
import { PosterDraftsService } from "./poster-drafts.service";

// Affiches enregistrées en ligne : coach, président et bureau seulement (403 pour tous les autres).
@Roles(Role.COACH, Role.PRESIDENT, Role.BUREAU)
@Controller("poster-drafts")
export class PosterDraftsController {
  constructor(private readonly svc: PosterDraftsService) {}
  @Get() list() { return this.svc.list(); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateDraftDto) { return this.svc.create(u, dto); }
  @Get(":id") get(@Param("id") id: string) { return this.svc.get(id); }
  @Put(":id") @HttpCode(200) update(@Param("id") id: string, @Body() dto: UpdateDraftDto) { return this.svc.update(id, dto); }
  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) { return this.svc.remove(id); }
  @Post(":id/photos") addPhoto(@Param("id") id: string, @Req() req: Request) { return this.svc.addPhoto(id, req.body); }
  @Get(":id/photos/:pid")
  async photo(@Param("id") id: string, @Param("pid") pid: string, @Res() res: Response) {
    const r = await this.svc.photo(id, pid);
    res.status(200).set({ "Content-Type": r.mime, "Content-Length": String(r.data.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" }).end(r.data);
  }
}
