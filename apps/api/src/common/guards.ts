import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { COOKIE_ACCESS } from "./auth.types";

// Toute route exige une connexion, sauf celles marquées @Public().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>("isPublic", [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[COOKIE_ACCESS];
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, email: true, deletedAt: true, mustChangePassword: true } });
      if (!user || user.deletedAt) throw new UnauthorizedException();
      req.user = { id: user.id, role: user.role, email: user.email };
      // Mot de passe provisoire : on ne peut rien faire d'autre que le changer.
      if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>("allowMustChange", [ctx.getHandler(), ctx.getClass()])) {
        throw new ForbiddenException({ message: "Tu dois d'abord choisir ton mot de passe.", code: "PASSWORD_CHANGE_REQUIRED" });
      }
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException();
    }
  }
}

// Réserve une route à certains rôles (ex. le coach).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [ctx.getHandler(), ctx.getClass()]);
    if (!roles || !roles.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException("Accès non autorisé");
    return true;
  }
}

// Protection contre les requêtes envoyées depuis un autre site (CSRF) : on exige que l'origine soit celle du site.
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    const allowed = (process.env.WEB_ORIGIN || "").replace(/\/$/, "");
    const origin = req.headers.origin as string | undefined;
    const referer = req.headers.referer as string | undefined;
    let from = origin;
    if (!from && referer) { try { from = new URL(referer).origin; } catch { throw new ForbiddenException("Origine invalide"); } }
    if (!from) {
      if (process.env.NODE_ENV === "production") throw new ForbiddenException("Origine manquante");
      return true;
    }
    if (from !== allowed) throw new ForbiddenException("Origine non autorisée");
    return true;
  }
}
