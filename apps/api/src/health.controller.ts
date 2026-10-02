import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators";
import { PrismaService } from "./prisma/prisma.service";

// Texte d'erreur nettoyé : jamais d'adresse, de mot de passe ni de nom de serveur.
export function safeError(e: unknown): string {
  const err = e as { name?: string; code?: string; message?: string };
  const msg = String(err?.message ?? "").split("\n").filter(Boolean).slice(-1)[0] ?? "";
  const clean = msg.replace(/`[^`]*`/g, "…").replace(/[a-z]+:\/\/\S+/gi, "…").replace(/\S+@\S+/g, "…").slice(0, 160);
  return [err?.name, err?.code, clean].filter(Boolean).join(" · ");
}

// Vérification de santé : dit si la base répond et si les tables existent (sans rien révéler de secret).
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public() @Get()
  async health() {
    const out: Record<string, unknown> = { serveur: "ok" };
    try { await this.prisma.$queryRaw`SELECT 1`; out.connexion = "ok"; } catch (e) { out.connexion = "ECHEC"; out.detail = safeError(e); return { ok: false, ...out }; }
    try { await this.prisma.user.count(); out.tables = "ok"; } catch (e) { out.tables = "ECHEC (tables absentes ?)"; out.detail = safeError(e); return { ok: false, ...out }; }
    return { ok: true, ...out };
  }
}
