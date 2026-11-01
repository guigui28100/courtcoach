import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "../common/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDraftDto, UpdateDraftDto } from "./poster-drafts.dto";

export const MAX_DRAFTS = 50, MAX_PHOTOS = 24, MAX_PHOTO_BYTES = 1_500_000;
export const RETENTION_MS = 365 * 24 * 3600 * 1000; // 12 mois sans modification, comme les vidéos

// Vrai format de la photo (jamais le nom ni le type annoncé)
export function sniffPhoto(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
const checkData = (data: string) => {
  try { const j = JSON.parse(data); if (!j || typeof j !== "object" || Array.isArray(j)) throw 0; } catch { throw new BadRequestException("Affiche illisible."); }
};
const refs = (data: string) => new Set([...data.matchAll(/srv:([A-Za-z0-9]{8,40})/g)].map((m) => m[1]));

// Affiches enregistrées EN LIGNE (coach, président, bureau) : partagées entre eux, jamais visibles des familles, jeunes ou adultes.
@Injectable()
export class PosterDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.posterDraft.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, kind: true, name: true, authorName: true, updatedAt: true, _count: { select: { photos: true } } } })
      .then((rows) => rows.map(({ _count, ...r }) => ({ ...r, photos: _count.photos })));
  }
  async create(u: AuthUser, dto: CreateDraftDto) {
    checkData(dto.data);
    if ((await this.prisma.posterDraft.count()) >= MAX_DRAFTS) throw new ConflictException(`${MAX_DRAFTS} affiches enregistrées au plus : supprime-en une avant d'en ajouter.`);
    const me = await this.prisma.user.findUnique({ where: { id: u.id }, select: { firstName: true } });
    const d = await this.prisma.posterDraft.create({ data: { kind: dto.kind, name: dto.name, data: dto.data, authorId: u.id, authorName: me?.firstName ?? null } });
    return { id: d.id };
  }
  async update(id: string, dto: UpdateDraftDto) {
    checkData(dto.data);
    await this.find(id);
    const keep = refs(dto.data);
    // Les photos qui ne figurent plus dans l'affiche sont effacées du serveur
    const photos = await this.prisma.posterPhoto.findMany({ where: { draftId: id }, select: { id: true } });
    const drop = photos.map((p) => p.id).filter((x) => !keep.has(x));
    if (drop.length) await this.prisma.posterPhoto.deleteMany({ where: { draftId: id, id: { in: drop } } });
    await this.prisma.posterDraft.update({ where: { id }, data: { name: dto.name, data: dto.data } });
    return { id };
  }
  async get(id: string) {
    const d = await this.prisma.posterDraft.findUnique({ where: { id } });
    if (!d) throw new NotFoundException("Affiche introuvable.");
    return { id: d.id, kind: d.kind, name: d.name, data: d.data, updatedAt: d.updatedAt };
  }
  async remove(id: string) { await this.find(id); await this.prisma.posterDraft.delete({ where: { id } }); }

  async addPhoto(id: string, body: unknown) {
    await this.find(id);
    if (!Buffer.isBuffer(body) || !body.length) throw new BadRequestException("Photo vide.");
    if (body.length > MAX_PHOTO_BYTES) throw new BadRequestException("Photo trop lourde (1,5 Mo au plus).");
    const mime = sniffPhoto(body); if (!mime) throw new BadRequestException("Choisis une vraie photo JPEG, PNG ou WebP.");
    if ((await this.prisma.posterPhoto.count({ where: { draftId: id } })) >= MAX_PHOTOS) throw new ConflictException(`${MAX_PHOTOS} photos au plus par affiche.`);
    const p = await this.prisma.posterPhoto.create({ data: { draftId: id, mime, data: Uint8Array.from(body) } });
    return { id: p.id };
  }
  async photo(id: string, pid: string) {
    const p = await this.prisma.posterPhoto.findFirst({ where: { id: pid, draftId: id } });
    if (!p) throw new NotFoundException("Photo introuvable.");
    return { mime: p.mime, data: Buffer.from(p.data) };
  }
  private async find(id: string) { const d = await this.prisma.posterDraft.findUnique({ where: { id }, select: { id: true } }); if (!d) throw new NotFoundException("Affiche introuvable."); }
}
