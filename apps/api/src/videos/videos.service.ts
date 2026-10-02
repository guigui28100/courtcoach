import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsentKind, Role, Video, VideoStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser } from "../common/auth.types";
import { AnalysisDto, CreateVideoDto, MAX_VIDEO_BYTES } from "./dto";

export const CHUNK_SIZE = 2 * 1024 * 1024; // le fichier est envoyé et gardé par morceaux de 2 Mo
const RETENTION_MS = 365 * 24 * 3600 * 1000; // conservation : 12 mois
const STALE_UPLOAD_MS = 24 * 3600 * 1000;
const quotaBytes = () => (Number(process.env.VIDEO_QUOTA_MB) || 350) * 1024 * 1024;

// Reconnaît le vrai format du fichier (et pas seulement son nom) : MP4/MOV ou WebM.
export function sniffVideo(head: Buffer): string | null {
  if (head.length >= 12 && head.subarray(4, 8).toString("latin1") === "ftyp") return head.subarray(8, 12).toString("latin1") === "qt  " ? "video/quicktime" : "video/mp4";
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return "video/webm";
  return null;
}

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ----- Qui a le droit de voir quelle vidéo (cloisonnement strict) -----
  // Coach : tout. Adulte « demande de coaching » : seulement ses propres vidéos, jamais celles d'un jeune.
  // Parent / jeune : seulement les vidéos des joueurs auxquels le coach lui a donné accès, jamais celles des adultes.
  private async load(user: AuthUser, id: string): Promise<Video> {
    const v = await this.prisma.video.findUnique({ where: { id } });
    if (!v) throw new NotFoundException("Vidéo introuvable");
    if (user.role === Role.COACH) return v;
    if (user.role === Role.ADULT) { if (v.ownerId === user.id && !v.playerId) return v; throw new NotFoundException("Vidéo introuvable"); }
    if (v.playerId && (await this.prisma.playerAccess.findUnique({ where: { userId_playerId: { userId: user.id, playerId: v.playerId } } }))) return v;
    throw new NotFoundException("Vidéo introuvable");
  }
  private async imageConsent(playerId: string) {
    return !!(await this.prisma.consent.findFirst({ where: { playerId, kind: ConsentKind.IMAGE, withdrawnAt: null } }));
  }

  // ----- Envoi en trois temps : annoncer, envoyer les morceaux, terminer -----
  async create(user: AuthUser, dto: CreateVideoDto) {
    let ownerId: string | null = null, playerId: string | null = null;
    if (user.role === Role.ADULT) {
      if (dto.playerId) throw new ForbiddenException("Accès non autorisé");
      ownerId = user.id;
      if ((await this.prisma.video.count({ where: { ownerId } })) >= 10) throw new BadRequestException("Tu as déjà 10 vidéos : supprime-en une avant d'en ajouter.");
    } else {
      if (!dto.playerId) throw new BadRequestException("Choisis le joueur concerné.");
      if (user.role !== Role.COACH && !(await this.prisma.playerAccess.findUnique({ where: { userId_playerId: { userId: user.id, playerId: dto.playerId } } }))) throw new NotFoundException("Fiche introuvable");
      if (!(await this.prisma.player.findUnique({ where: { id: dto.playerId }, select: { id: true } }))) throw new NotFoundException("Fiche introuvable");
      // Accord obligatoire : pas de vidéo d'un jeune sans l'autorisation « droit à l'image » des parents.
      if (!(await this.imageConsent(dto.playerId))) throw new ForbiddenException("L'accord des parents « droit à l'image » n'est pas enregistré : aucune vidéo ne peut être ajoutée.");
      playerId = dto.playerId;
    }
    const used = (await this.prisma.video.aggregate({ _sum: { sizeBytes: true } }))._sum.sizeBytes ?? 0;
    if (used + dto.sizeBytes > quotaBytes()) throw new HttpException("L'espace de stockage du club est plein. Préviens le coach.", 507);
    const chunkCount = Math.ceil(dto.sizeBytes / CHUNK_SIZE);
    const v = await this.prisma.video.create({ data: { title: dto.title, shot: dto.shot, question: dto.question ?? "", sizeBytes: dto.sizeBytes, chunkCount, ownerId, playerId } });
    if (playerId) await this.prisma.player.update({ where: { id: playerId }, data: { lastActivityAt: new Date() } });
    return { id: v.id, chunkSize: CHUNK_SIZE, chunkCount };
  }

  async putChunk(user: AuthUser, id: string, index: number, body: unknown) {
    const v = await this.load(user, id);
    if (v.complete) throw new BadRequestException("Envoi déjà terminé");
    if (!Number.isInteger(index) || index < 0 || index >= v.chunkCount) throw new BadRequestException("Morceau invalide");
    if (!Buffer.isBuffer(body)) throw new BadRequestException("Morceau invalide");
    const expected = index === v.chunkCount - 1 ? v.sizeBytes - index * CHUNK_SIZE : CHUNK_SIZE;
    if (body.length !== expected) throw new BadRequestException("Morceau de taille inattendue");
    const data = Uint8Array.from(body);
    await this.prisma.videoChunk.upsert({ where: { videoId_index: { videoId: id, index } }, update: { data }, create: { videoId: id, index, data } });
  }

  async complete(user: AuthUser, id: string) {
    const v = await this.load(user, id);
    if (v.complete) return this.summary(v);
    const chunks = await this.prisma.videoChunk.findMany({ where: { videoId: id }, select: { index: true, data: true }, orderBy: { index: "asc" } });
    const head = chunks[0]?.data ? Buffer.from(chunks[0].data) : Buffer.alloc(0);
    const mime = sniffVideo(head);
    const ok = chunks.length === v.chunkCount && chunks.every((c, i) => c.index === i) && chunks.reduce((n, c) => n + c.data.length, 0) === v.sizeBytes && !!mime;
    if (!ok) { await this.prisma.video.delete({ where: { id } }); throw new BadRequestException("Le fichier est incomplet ou n'est pas une vidéo (MP4, MOV ou WebM). Recommence l'envoi."); }
    const done = await this.prisma.video.update({ where: { id }, data: { complete: true, mimeType: mime!, deleteAfter: new Date(Date.now() + RETENTION_MS), recordedAt: new Date() } });
    await this.audit.log(user.id, "video-upload", "Video", id);
    return this.summary(done);
  }

  // ----- Lecture du fichier, par tranches (compatible avec la lecture vidéo des navigateurs) -----
  async readRange(user: AuthUser, id: string, header?: string) {
    const v = await this.load(user, id);
    if (!v.complete) throw new NotFoundException("Vidéo introuvable");
    let start = 0, end = v.sizeBytes - 1;
    if (header) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
      if (!m || (!m[1] && !m[2])) throw new HttpException("Plage invalide", 416);
      if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(Number(m[2]), end); } else { start = Math.max(0, v.sizeBytes - Number(m[2])); }
      if (start >= v.sizeBytes || start > end) throw new HttpException("Plage invalide", 416);
    }
    end = Math.min(end, start + CHUNK_SIZE - 1); // jamais plus d'un morceau d'un coup (limite des fonctions Vercel)
    const first = Math.floor(start / CHUNK_SIZE), last = Math.floor(end / CHUNK_SIZE);
    const rows = await this.prisma.videoChunk.findMany({ where: { videoId: id, index: { gte: first, lte: last } }, orderBy: { index: "asc" } });
    const all = Buffer.concat(rows.map((r) => Buffer.from(r.data)));
    const offset = start - first * CHUNK_SIZE;
    return { data: all.subarray(offset, offset + (end - start + 1)), start, end, total: v.sizeBytes, mime: v.mimeType };
  }

  // ----- Listes -----
  private summary(v: Video & { player?: { id: string; firstName: string } | null; owner?: { id: string; firstName: string | null; email: string } | null; analyses?: any[]; _count?: { messages: number } }, user?: AuthUser) {
    const a = v.analyses?.[0];
    const coach = user?.role === Role.COACH;
    const visible = a && (coach || a.sentAt);
    return {
      id: v.id, title: v.title, shot: v.shot, question: v.question, status: v.status, sizeBytes: v.sizeBytes, mimeType: v.mimeType, complete: v.complete,
      recordedAt: v.recordedAt, deleteAfter: v.deleteAfter, seenAt: v.seenAt,
      kind: v.playerId ? "centre" : "coaching",
      player: v.player ? { id: v.player.id, firstName: v.player.firstName } : null,
      owner: coach && v.owner ? { id: v.owner.id, firstName: v.owner.firstName, email: v.owner.email } : null,
      analysis: visible ? this.analysisOut(a) : null,
      messageCount: v._count?.messages ?? 0,
    };
  }
  private analysisOut(a: any) {
    return { id: a.id, observation: a.observation, strengths: a.strengths, improve: a.improve, exercises: a.exercises, sentAt: a.sentAt, goalIds: (a.goals ?? []).map((g: any) => g.goalId) };
  }
  private readonly include = { player: { select: { id: true, firstName: true } }, owner: { select: { id: true, firstName: true, email: true } }, analyses: { include: { goals: true }, orderBy: { createdAt: "desc" as const }, take: 1 }, _count: { select: { messages: true } } };

  async list(user: AuthUser) {
    if (user.role === Role.COACH) await this.purgeExpired();
    const where = user.role === Role.COACH ? { complete: true }
      : user.role === Role.ADULT ? { complete: true, ownerId: user.id, playerId: null }
      : { complete: true, player: { accesses: { some: { userId: user.id } } } };
    const rows = await this.prisma.video.findMany({ where, include: this.include, orderBy: { recordedAt: "desc" } });
    return rows.map((v) => this.summary(v, user));
  }

  async storage() {
    const used = (await this.prisma.video.aggregate({ _sum: { sizeBytes: true }, _count: true }))._sum.sizeBytes ?? 0;
    return { usedBytes: used, quotaBytes: quotaBytes(), maxVideoBytes: MAX_VIDEO_BYTES };
  }

  // ----- Détail, discussion -----
  async detail(user: AuthUser, id: string) {
    await this.load(user, id);
    const v = await this.prisma.video.findUniqueOrThrow({ where: { id }, include: this.include });
    const out = this.summary(v, user);
    const talk = user.role === Role.COACH || !!out.analysis?.sentAt;
    const msgs = talk ? await this.prisma.message.findMany({ where: { videoId: id }, orderBy: { createdAt: "asc" } }) : [];
    const authors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(msgs.map((m) => m.authorId))] } }, select: { id: true, role: true } });
    const roleOf = new Map(authors.map((a) => [a.id, a.role]));
    const goals = user.role === Role.COACH && v.playerId ? await this.prisma.goal.findMany({ where: { playerId: v.playerId }, orderBy: { createdAt: "asc" }, select: { id: true, axis: true, title: true, season: true } }) : [];
    const linked = v.playerId && out.analysis ? await this.prisma.goal.findMany({ where: { id: { in: out.analysis.goalIds } }, select: { id: true, axis: true, title: true } }) : [];
    return { ...out, messages: msgs.map((m) => ({ id: m.id, text: m.text, createdAt: m.createdAt, fromCoach: roleOf.get(m.authorId) === Role.COACH, mine: m.authorId === user.id })), goals, linkedGoals: linked };
  }

  async addMessage(user: AuthUser, id: string, text: string) {
    await this.load(user, id);
    const a = await this.prisma.analysis.findFirst({ where: { videoId: id, sentAt: { not: null } } });
    if (!a) throw new ForbiddenException("La discussion s'ouvre une fois l'analyse envoyée.");
    return this.prisma.message.create({ data: { videoId: id, authorId: user.id, text } }).then((m) => ({ id: m.id }));
  }

  async markSeen(user: AuthUser, id: string) {
    const v = await this.load(user, id);
    if (user.role === Role.COACH) return;
    if (await this.prisma.analysis.findFirst({ where: { videoId: v.id, sentAt: { not: null } } })) await this.prisma.video.update({ where: { id }, data: { seenAt: new Date() } });
  }

  // ----- Analyse (coach) -----
  async saveAnalysis(user: AuthUser, id: string, dto: AnalysisDto) {
    if (user.role !== Role.COACH) throw new ForbiddenException("Réservé au coach");
    const v = await this.prisma.video.findUnique({ where: { id } });
    if (!v || !v.complete) throw new NotFoundException("Vidéo introuvable");
    // Centre de compétition : pas d'exercices correctifs, mais des liens vers les objectifs du joueur. Adultes : l'inverse.
    if (v.playerId && dto.exercises?.length) throw new BadRequestException("Pas d'exercices pour les jeunes du Centre.");
    if (!v.playerId && dto.goalIds?.length) throw new BadRequestException("Les objectifs concernent seulement les jeunes du Centre.");
    if (v.playerId && dto.goalIds?.length) {
      const n = await this.prisma.goal.count({ where: { id: { in: dto.goalIds }, playerId: v.playerId } });
      if (n !== new Set(dto.goalIds).size) throw new BadRequestException("Objectif invalide.");
    }
    const data = { observation: dto.observation ?? "", strengths: dto.strengths ?? "", improve: dto.improve ?? "", exercises: (dto.exercises ?? []).map((e) => e.trim()).filter(Boolean) };
    const existing = await this.prisma.analysis.findFirst({ where: { videoId: id } });
    const a = existing ? await this.prisma.analysis.update({ where: { id: existing.id }, data }) : await this.prisma.analysis.create({ data: { videoId: id, playerId: v.playerId, ...data } });
    if (dto.goalIds) {
      await this.prisma.analysisGoal.deleteMany({ where: { analysisId: a.id } });
      if (dto.goalIds.length) await this.prisma.analysisGoal.createMany({ data: [...new Set(dto.goalIds)].map((goalId) => ({ analysisId: a.id, goalId })) });
    }
    if (v.playerId) await this.prisma.player.update({ where: { id: v.playerId }, data: { lastActivityAt: new Date() } });
    return { id: a.id };
  }

  async sendAnalysis(user: AuthUser, id: string) {
    if (user.role !== Role.COACH) throw new ForbiddenException("Réservé au coach");
    const a = await this.prisma.analysis.findFirst({ where: { videoId: id } });
    if (!a || !a.observation.trim()) throw new BadRequestException("Écris au moins une observation avant d'envoyer l'analyse.");
    await this.prisma.$transaction([
      this.prisma.analysis.update({ where: { id: a.id }, data: { sentAt: a.sentAt ?? new Date() } }),
      this.prisma.video.update({ where: { id }, data: { status: VideoStatus.ANALYSED, ...(a.sentAt ? {} : { seenAt: null }) } }),
    ]);
    await this.audit.log(user.id, "analysis-send", "Video", id);
  }

  // ----- Suppression -----
  async remove(user: AuthUser, id: string) {
    await this.load(user, id);
    await this.prisma.video.delete({ where: { id } });
    await this.audit.log(user.id, "video-delete", "Video", id);
  }

  // Conservation limitée : les vidéos de plus de 12 mois et les envois jamais terminés sont supprimés.
  async purgeExpired() {
    const now = new Date();
    const a = await this.prisma.video.deleteMany({ where: { deleteAfter: { lt: now } } });
    const b = await this.prisma.video.deleteMany({ where: { complete: false, recordedAt: { lt: new Date(now.getTime() - STALE_UPLOAD_MS) } } });
    return { expired: a.count, incomplete: b.count };
  }
}
