import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { randomInt } from "crypto";
import { hash } from "@node-rs/argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser } from "../common/auth.types";
import { TrainerDto } from "./dto";

// Entraîneurs de comité : comptes créés par le coach, qui ne voient QUE les jeunes que le coach leur confie.
// Le contrôleur est réservé au coach : un entraîneur ne peut ni créer un compte ni changer ses propres jeunes.
@Injectable()
export class TrainersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    return Array.from({ length: 14 }, () => alphabet[randomInt(alphabet.length)]).join("");
  }
  private async checkPlayers(playerIds: string[]) {
    const ids = [...new Set(playerIds)];
    if ((await this.prisma.player.count({ where: { id: { in: ids } } })) !== ids.length) throw new BadRequestException("Un des jeunes choisis n'existe pas.");
    return ids;
  }
  private async trainer(id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, role: Role.TRAINER, deletedAt: null } });
    if (!u) throw new NotFoundException("Entraîneur introuvable");
    return u;
  }

  async list() {
    const rows = await this.prisma.user.findMany({ where: { role: Role.TRAINER, deletedAt: null }, orderBy: { createdAt: "asc" }, include: { accesses: { select: { playerId: true } } } });
    return rows.map((u) => ({ id: u.id, email: u.email, firstName: u.firstName, mustChangePassword: u.mustChangePassword, lastLoginAt: u.lastLoginAt, twoFactor: u.totpEnabled, playerIds: u.accesses.map((a: { playerId: string }) => a.playerId) }));
  }

  async create(user: AuthUser, dto: TrainerDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException("Cet e-mail est déjà utilisé par un autre compte.");
    const ids = await this.checkPlayers(dto.playerIds ?? []);
    const temporaryPassword = this.generatePassword();
    const u = await this.prisma.user.create({ data: { email, role: Role.TRAINER, firstName: dto.firstName.trim(), passwordHash: await hash(temporaryPassword), mustChangePassword: true } });
    if (ids.length) await this.prisma.playerAccess.createMany({ data: ids.map((playerId) => ({ userId: u.id, playerId, relation: "entraineur" })) });
    await this.audit.log(user.id, "create-trainer", "User", u.id);
    return { id: u.id, email, temporaryPassword }; // montré une seule fois
  }

  // Remplace la liste des jeunes confiés à cet entraîneur (cocher / décocher)
  async setPlayers(user: AuthUser, id: string, playerIds: string[]) {
    await this.trainer(id);
    const ids = await this.checkPlayers(playerIds);
    await this.prisma.$transaction([
      this.prisma.playerAccess.deleteMany({ where: { userId: id, playerId: { notIn: ids } } }),
      ...ids.map((playerId) => this.prisma.playerAccess.upsert({ where: { userId_playerId: { userId: id, playerId } }, update: {}, create: { userId: id, playerId, relation: "entraineur" } })),
    ]);
    await this.audit.log(user.id, "set-trainer-players", "User", id);
    return { playerIds: ids };
  }

  async resetPassword(user: AuthUser, id: string) {
    const u = await this.trainer(id);
    const temporaryPassword = this.generatePassword();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash: await hash(temporaryPassword), mustChangePassword: true, failedLogins: 0, lockedUntil: null } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log(user.id, "reset-password", "User", id);
    return { email: u.email, temporaryPassword };
  }

  async remove(user: AuthUser, id: string) {
    await this.trainer(id);
    await this.prisma.$transaction([
      this.prisma.playerAccess.deleteMany({ where: { userId: id } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({ where: { id }, data: { email: `supprime-${id}@invalid`, firstName: null, passwordHash: "-", totpEnabled: false, deletedAt: new Date() } }),
    ]);
    await this.audit.log(user.id, "remove-trainer", "User", id);
  }
}
