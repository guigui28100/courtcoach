import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseIntPipe, Post, Put, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Public, Roles } from "../common/decorators";
import { AnalysisDto, CreateVideoDto, MessageDto } from "./dto";
import { VideosService } from "./videos.service";

@Controller()
export class VideosController {
  constructor(private readonly svc: VideosService) {}

  @Get("videos") list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Roles(Role.COACH) @Get("videos/storage") storage() { return this.svc.storage(); }
  @Post("videos") create(@CurrentUser() u: AuthUser, @Body() dto: CreateVideoDto) { return this.svc.create(u, dto); }
  @Put("videos/:id/chunks/:n") @HttpCode(204) chunk(@CurrentUser() u: AuthUser, @Param("id") id: string, @Param("n", ParseIntPipe) n: number, @Req() req: Request) { return this.svc.putChunk(u, id, n, req.body); }
  @Post("videos/:id/complete") complete(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.complete(u, id); }

  @Get("videos/:id/file")
  async file(@CurrentUser() u: AuthUser, @Param("id") id: string, @Headers("range") range: string | undefined, @Res() res: Response) {
    const r = await this.svc.readRange(u, id, range);
    res.status(206).set({
      "Content-Type": r.mime, "Content-Length": String(r.data.length), "Content-Range": `bytes ${r.start}-${r.end}/${r.total}`, "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline",
    }).end(r.data);
  }

  @Get("videos/:id") detail(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.detail(u, id); }
  @Delete("videos/:id") @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
  @Post("videos/:id/seen") @HttpCode(204) seen(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.markSeen(u, id); }
  @Post("videos/:id/messages") message(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: MessageDto) { return this.svc.addMessage(u, id, dto.text); }
  @Roles(Role.COACH) @Put("videos/:id/analysis") saveAnalysis(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: AnalysisDto) { return this.svc.saveAnalysis(u, id, dto); }
  @Roles(Role.COACH) @Post("videos/:id/analysis/send") @HttpCode(204) sendAnalysis(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.sendAnalysis(u, id); }

  // Appelée chaque nuit par Vercel (tâche planifiée) : supprime les vidéos de plus de 12 mois.
  @Public() @Get("cron/purge")
  async purge(@Headers("authorization") auth?: string) {
    const secret = process.env.CRON_SECRET;
    const given = Buffer.from(auth ?? ""), expected = Buffer.from(`Bearer ${secret ?? ""}`);
    if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
    return this.svc.purgeExpired();
  }
}
