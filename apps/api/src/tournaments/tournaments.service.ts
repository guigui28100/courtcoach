import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, isStaff } from "../common/auth.types";

export const MAX_DOC_BYTES = 3 * 1024 * 1024; // 3 Mo (une requête sur Vercel est limitée à 4,5 Mo)
const RETENTION_MS = 365 * 24 * 3600 * 1000; // conservation : 12 mois

// Reconnaît le vrai format du fichier (pas seulement son nom) : PDF, JPEG, PNG, Word (.docx) ou Excel (.xlsx)
export function sniffDoc(b: Buffer, fileName: string): { mime: string; inline: boolean } | null {
  if (b.length > 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", inline: true };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", inline: true };
  if (b.length > 8 && b.subarray(1, 4).toString("latin1") === "PNG") return { mime: "image/png", inline: true };
  if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    const head = b.subarray(0, Math.min(b.length, 64 * 1024)).toString("latin1");
    if (/\.docx$/i.test(fileName) && head.includes("word/")) return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false };
    if (/\.xlsx$/i.test(fileName) && head.includes("xl/")) return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false };
  }
  return null;
}
const cleanName = (n: string) => n.replace(/[\\/\0-\x1f"]/g, "_").trim().slice(0, 120) || "document";

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // Fiches que la personne peut voir (coach : toutes ; entraîneur / famille / jeune : celles qui lui sont confiées)
  private async myPlayerIds(user: AuthUser) {
    return (await this.prisma.playerAccess.findMany({ where: { userId: user.id }, select: { playerId: true } })).map((a) => a.playerId);
  }
  // Documents visibles : coach = tous ; entraîneur = ceux de ses jeunes ; jeune et famille = ceux de leur joueur, SEULEMENT s'ils sont partagés
  private async visibleWhere(user: AuthUser) {
    if (user.role === Role.COACH) return {};
    const ids = await this.myPlayerIds(user);
    if (user.role === Role.TRAINER) return { players: { some: { playerId: { in: ids } } } };
    if (user.role === Role.GUARDIAN || user.role === Role.YOUTH) return { shared: true, players: { some: { playerId: { in: ids } } } };
    throw new ForbiddenException("Accès non autorisé");
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.tournamentDoc.findMany({
      where: await this.visibleWhere(user), orderBy: { createdAt: "desc" },
      select: { id: true, title: true, fileName: true, mimeType: true, sizeBytes: true, shared: true, createdAt: true, deleteAfter: true, uploadedById: true, authorName: true, authorRole: true, players: { select: { player: { select: { id: true, firstName: true } } } } },
    });
    const mine = user.role === Role.COACH ? null : new Set(await this.myPlayerIds(user));
    return rows.map((d) => {
      const players = d.players.map((p) => p.player).filter((p) => !mine || mine.has(p.id)); // jamais le nom d'un jeune qui n'est pas le sien
      const base = { id: d.id, title: d.title, fileName: d.fileName, mimeType: d.mimeType, sizeBytes: d.sizeBytes, createdAt: d.createdAt, deleteAfter: d.deleteAfter, players };
      return isStaff(user) ? { ...base, shared: d.shared, authorName: d.authorName, authorRole: d.authorRole, mine: d.uploadedById === user.id, canDelete: user.role === Role.COACH || d.uploadedById === user.id } : base;
    });
  }

  async create(user: AuthUser, q: { title: string; fileName: string; playerIds: string[]; shared: boolean }, body: unknown) {
    if (!Buffer.isBuffer(body) || !body.length) throw new BadRequestException("Document vide ou illisible.");
    if (body.length > MAX_DOC_BYTES) throw new BadRequestException("Document trop lourd (3 Mo maximum).");
    const title = (q.title ?? "").trim().slice(0, 120), fileName = cleanName(q.fileName ?? "");
    if (!title) throw new BadRequestException("Donne un titre au document (ex. : Tournoi de Dreux, 12 octobre).");
    const kind = sniffDoc(body, fileName);
    if (!kind) throw new BadRequestException("Format non accepté : PDF, image (JPEG ou PNG), Word (.docx) ou Excel (.xlsx).");
    const ids = [...new Set(q.playerIds.filter(Boolean))];
    if (!ids.length) throw new BadRequestException("Choisis au moins un jeune concerné.");
    if (ids.length > 50) throw new BadRequestException("Trop de jeunes sélectionnés.");
    if ((await this.prisma.player.count({ where: { id: { in: ids } } })) !== ids.length) throw new NotFoundException("Fiche introuvable");
    if (user.role === Role.TRAINER) { const mine = new Set(await this.myPlayerIds(user)); if (ids.some((i) => !mine.has(i))) throw new NotFoundException("Fiche introuvable"); }
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true } });
    const doc = await this.prisma.tournamentDoc.create({
      data: { title, fileName, mimeType: kind.mime, sizeBytes: body.length, data: Uint8Array.from(body), shared: !!q.shared, uploadedById: user.id, authorName: me?.firstName || (user.role === Role.COACH ? "Coach" : "Entraîneur"), authorRole: user.role, deleteAfter: new Date(Date.now() + RETENTION_MS), players: { create: ids.map((playerId) => ({ playerId })) } },
      select: { id: true },
    });
    await this.audit.log(user.id, "tournament-upload", "TournamentDoc", doc.id);
    return { id: doc.id };
  }

  async file(user: AuthUser, id: string) {
    const d = await this.prisma.tournamentDoc.findFirst({ where: { id, ...(await this.visibleWhere(user)) } });
    if (!d) throw new NotFoundException("Document introuvable");
    if (isStaff(user)) await this.audit.log(user.id, "view", "TournamentDoc", id);
    return { data: Buffer.from(d.data), mime: d.mimeType, name: d.fileName, inline: d.mimeType === "application/pdf" || d.mimeType.startsWith("image/") };
  }

  async remove(user: AuthUser, id: string) {
    const d = await this.prisma.tournamentDoc.findFirst({ where: { id, ...(await this.visibleWhere(user)) }, select: { id: true, uploadedById: true } });
    if (!d) throw new NotFoundException("Document introuvable");
    if (user.role !== Role.COACH && d.uploadedById !== user.id) throw new ForbiddenException("Tu ne peux supprimer que les documents que tu as déposés.");
    await this.prisma.tournamentDoc.delete({ where: { id } });
    await this.audit.log(user.id, "tournament-delete", "TournamentDoc", id);
  }
}
