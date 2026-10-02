import { BadRequestException, Body, Controller, Get, NotFoundException, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Role } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { timingSafeEqual } from "crypto";
import { Public } from "../common/decorators";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";

class CreateCoachDto {
  @IsString() @MaxLength(200) token: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(12, { message: "Le mot de passe du coach doit faire au moins 12 caractères." }) @MaxLength(128) password: string;
}

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

// Installation : crée le TOUT PREMIER compte coach, une seule fois.
// Ça ne marche que si (1) une clé secrète SETUP_TOKEN a été réglée sur Vercel et (2) aucun coach n'existe encore.
@Controller("setup")
export class SetupController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async available() {
    if (!process.env.SETUP_TOKEN || process.env.SETUP_TOKEN.length < 16) return false;
    return (await this.prisma.user.count({ where: { role: Role.COACH } })) === 0;
  }

  @Public() @Get("status")
  async status() { return { available: await this.available() }; }

  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post("coach")
  async createCoach(@Body() dto: CreateCoachDto) {
    if (!(await this.available())) throw new NotFoundException();
    if (!same(dto.token, process.env.SETUP_TOKEN!)) throw new BadRequestException("Clé d'installation incorrecte.");
    const user = await this.prisma.user.create({ data: { email: dto.email.trim().toLowerCase(), role: Role.COACH, firstName: "Coach", passwordHash: await hash(dto.password) } });
    await this.audit.log(user.id, "setup-coach", "User", user.id);
    return { ok: true };
  }
}
