import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConsentKind, Role } from "@prisma/client";
import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
export const POLICY_VERSION = "2026-10";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// Faux hachage utilisé quand l'e-mail n'existe pas : le temps de réponse reste le même (on ne révèle pas qui a un compte).
const DUMMY_HASH = hash("mot-de-passe-factice-pour-egaliser-le-temps");

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly audit: AuditService) {}

  private async issueTokens(userId: string, role: Role) {
    const access = await this.jwt.signAsync({ sub: userId, role }, { expiresIn: ACCESS_TTL_S });
    const refresh = randomBytes(48).toString("base64url");
    await this.prisma.refreshToken.create({ data: { userId, tokenHash: sha256(refresh), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) } });
    return { access, refresh, accessMaxAgeMs: ACCESS_TTL_S * 1000, refreshMaxAgeMs: REFRESH_TTL_MS };
  }

  async signup(dto: { email: string; password: string; firstName?: string }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException("Un compte existe déjà avec cet e-mail.");
    const user = await this.prisma.user.create({
      data: {
        email: dto.email, role: Role.ADULT, firstName: dto.firstName || null,
        passwordHash: await hash(dto.password),
        consents: { create: { kind: ConsentKind.PRIVACY_POLICY, givenBy: dto.firstName || dto.email, policyVersion: POLICY_VERSION } },
      },
    });
    await this.audit.log(user.id, "signup", "User", user.id);
    return { user, tokens: await this.issueTokens(user.id, user.role) };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const locked = user?.lockedUntil && user.lockedUntil > new Date();
    const ok = await verify(user && !user.deletedAt ? user.passwordHash : await DUMMY_HASH, password).catch(() => false);
    if (!user || user.deletedAt || locked || !ok) {
      if (user && !locked) {
        const fails = user.failedLogins + 1;
        await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null } });
      }
      throw new UnauthorizedException("E-mail ou mot de passe incorrect.");
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    return { user, tokens: await this.issueTokens(user.id, user.role) };
  }

  // Renouvelle la connexion : l'ancien jeton est retiré et un nouveau est donné (rotation).
  async refresh(raw: string | undefined) {
    if (!raw) throw new UnauthorizedException();
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } });
    if (!row || row.revokedAt || row.expiresAt < new Date() || row.user.deletedAt) {
      // Jeton déjà utilisé = vol possible : on ferme toutes les sessions de cette personne.
      if (row && row.revokedAt) await this.prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException();
    }
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return { user: row.user, tokens: await this.issueTokens(row.userId, row.user.role) };
  }

  async logout(raw: string | undefined) {
    if (raw) await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  // ----- Invitations (le coach invite un parent ou un jeune) -----
  async previewInvitation(token: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { player: { select: { firstName: true } } } });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) throw new NotFoundException("Invitation introuvable ou expirée.");
    return { email: inv.email, role: inv.role, playerFirstName: inv.player.firstName };
  }

  async acceptInvitation(dto: { token: string; password: string; firstName?: string }) {
    const inv = await this.prisma.invitation.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) throw new NotFoundException("Invitation introuvable ou expirée.");
    // Un jeune ne peut avoir un compte que si l'accord écrit de ses parents est déjà enregistré.
    if (inv.role === Role.YOUTH) {
      const ok = await this.prisma.consent.findFirst({ where: { playerId: inv.playerId, kind: ConsentKind.ACCOUNT, withdrawnAt: null } });
      if (!ok) throw new ForbiddenException("L'accord des parents pour un compte en ligne n'est pas encore enregistré.");
    }
    if (await this.prisma.user.findUnique({ where: { email: inv.email } })) throw new ConflictException("Un compte existe déjà avec cet e-mail.");
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: inv.email, role: inv.role, firstName: dto.firstName || null, passwordHash: await hash(dto.password),
          consents: { create: { kind: ConsentKind.PRIVACY_POLICY, givenBy: dto.firstName || inv.email, playerId: inv.playerId, policyVersion: POLICY_VERSION } },
        },
      });
      await tx.playerAccess.create({ data: { userId: u.id, playerId: inv.playerId, relation: inv.role === Role.YOUTH ? "jeune" : "parent" } });
      await tx.invitation.update({ where: { id: inv.id }, data: { usedAt: new Date() } });
      return u;
    });
    await this.audit.log(user.id, "accept-invitation", "Invitation", inv.id);
    return { user, tokens: await this.issueTokens(user.id, user.role) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { accesses: { select: { playerId: true, relation: true } } } });
    return { id: user.id, email: user.email, role: user.role, firstName: user.firstName, accesses: user.accesses };
  }

  // Droit à l'effacement : le compte et ses données personnelles sont supprimés.
  async eraseAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.video.deleteMany({ where: { ownerId: userId } }),
      this.prisma.lessonRequest.deleteMany({ where: { memberId: userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.playerAccess.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { email: `supprime-${userId}@invalid`, firstName: null, passwordHash: "-", deletedAt: new Date() } }),
    ]);
    await this.audit.log(userId, "erase-account", "User", userId);
  }

  // Droit d'accès / portabilité : toutes les données du compte.
  async exportAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { consents: true, lessons: true, videos: { select: { title: true, shot: true, recordedAt: true, status: true } }, accesses: true } });
    const { passwordHash, failedLogins, lockedUntil, ...safe } = user;
    await this.audit.log(userId, "export-account", "User", userId);
    return { exportedAt: new Date().toISOString(), ...safe };
  }

  badRequest(msg: string): never { throw new BadRequestException(msg); }
}
