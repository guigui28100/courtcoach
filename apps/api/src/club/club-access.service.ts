import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { randomBytes } from "crypto";
import { sha256 } from "../auth/auth.service";
import { AuditService } from "../common/audit.service";
import { AuthUser } from "../common/auth.types";
import { forgetUser } from "../common/user-cache";
import { PrismaService } from "../prisma/prisma.service";
import { ClubInvitationDto } from "./club-access.dto";

const TTL_MS = 7 * 24 * 3600 * 1000;
const CLUB_ROLES: Role[] = [Role.PRESIDENT, Role.BUREAU];

// Accès du club (coach seul) : le président (planning + cours particuliers) et les membres du bureau (planning en lecture seule)
@Injectable()
export class ClubAccessService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list() {
    const users = await this.prisma.user.findMany({ where: { role: { in: CLUB_ROLES }, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, firstName: true, role: true, createdAt: true } });
    const invitations = await this.prisma.invitation.findMany({ where: { role: { in: CLUB_ROLES }, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, role: true, expiresAt: true } });
    return { users, invitations };
  }

  // Le lien est donné au coach UNE seule fois (aucun e-mail n'est envoyé par le site) ; la personne choisit elle-même son mot de passe
  async invite(user: AuthUser, dto: ClubInvitationDto) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) throw new ConflictException("Un compte existe déjà avec cet e-mail.");
    if (dto.role === Role.PRESIDENT) {
      const has = await this.prisma.user.findFirst({ where: { role: Role.PRESIDENT, deletedAt: null }, select: { id: true } });
      const pending = await this.prisma.invitation.findFirst({ where: { role: Role.PRESIDENT, usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
      if (has || pending) throw new ConflictException("Il y a déjà un président (ou une invitation en attente) : supprime-le d'abord.");
    }
    const token = randomBytes(32).toString("base64url");
    const inv = await this.prisma.invitation.create({ data: { tokenHash: sha256(token), email: dto.email, role: dto.role, invitedById: user.id, expiresAt: new Date(Date.now() + TTL_MS) } });
    await this.audit.log(user.id, "club-invite", "Invitation", inv.id);
    return { token, expiresInDays: 7 };
  }

  async cancelInvitation(user: AuthUser, id: string) {
    const inv = await this.prisma.invitation.findFirst({ where: { id, role: { in: CLUB_ROLES }, usedAt: null } });
    if (!inv) throw new NotFoundException("Invitation introuvable");
    await this.prisma.invitation.delete({ where: { id } });
    await this.audit.log(user.id, "club-invite-cancel", "Invitation", id);
  }

  // Supprime l'accès : le compte est fermé aussitôt (sessions coupées, données personnelles effacées)
  async remove(user: AuthUser, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, role: { in: CLUB_ROLES }, deletedAt: null } });
    if (!u) throw new NotFoundException("Accès introuvable");
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({ where: { id }, data: { email: `supprime-${id}@invalid`, firstName: null, lastName: null, passwordHash: "-", totpEnabled: false, totpSecret: null, deletedAt: new Date() } }),
    ]);
    forgetUser(id);
    await this.audit.log(user.id, "club-access-remove", "User", id);
  }
}
