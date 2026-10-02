import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { AcceptInvitationDto, LoginDto, SignupDto } from "./dto";
import { COOKIE_ACCESS, COOKIE_REFRESH, AuthUser } from "../common/auth.types";
import { CurrentUser, Public } from "../common/decorators";

const secure = () => process.env.NODE_ENV === "production";
const baseCookie = () => ({ httpOnly: true, secure: secure(), sameSite: "lax" as const });

function setSession(res: Response, t: { access: string; refresh: string; accessMaxAgeMs: number; refreshMaxAgeMs: number }) {
  res.cookie(COOKIE_ACCESS, t.access, { ...baseCookie(), path: "/", maxAge: t.accessMaxAgeMs });
  res.cookie(COOKIE_REFRESH, t.refresh, { ...baseCookie(), path: "/api/auth", maxAge: t.refreshMaxAgeMs });
}
const publicUser = (u: { id: string; email: string; role: string; firstName: string | null }) => ({ id: u.id, email: u.email, role: u.role, firstName: u.firstName });

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post("signup")
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.signup(dto);
    setSession(res, tokens);
    return publicUser(user);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(dto.email, dto.password);
    setSession(res, tokens);
    return publicUser(user);
  }

  @Public() @HttpCode(200) @Post("refresh")
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.refresh(req.cookies?.[COOKIE_REFRESH]);
    setSession(res, tokens);
    return publicUser(user);
  }

  @Public() @HttpCode(204) @Post("logout")
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE_REFRESH]);
    res.clearCookie(COOKIE_ACCESS, { ...baseCookie(), path: "/" });
    res.clearCookie(COOKIE_REFRESH, { ...baseCookie(), path: "/api/auth" });
  }

  @Get("me") me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }

  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @Get("invitations/:token")
  preview(@Param("token") token: string) { return this.auth.previewInvitation(token); }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post("invitations/accept")
  async accept(@Body() dto: AcceptInvitationDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.acceptInvitation(dto);
    setSession(res, tokens);
    return publicUser(user);
  }

  @Get("me/export") exportMine(@CurrentUser() u: AuthUser) { return this.auth.exportAccount(u.id); }

  @Delete("me") @HttpCode(204)
  async eraseMine(@CurrentUser() u: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.eraseAccount(u.id);
    res.clearCookie(COOKIE_ACCESS, { ...baseCookie(), path: "/" });
    res.clearCookie(COOKIE_REFRESH, { ...baseCookie(), path: "/api/auth" });
  }
}
