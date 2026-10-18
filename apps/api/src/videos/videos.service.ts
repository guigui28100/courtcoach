import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsentKind, Role, Video, VideoStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, isStaff } from "../common/auth.types";
import { AnalysisDto, CreateVideoDto, MAX_VIDEO_BYTES } from "./dto";

export const CHUNK_SIZE = 2 * 1024 * 1024; // le fichier est envoyé et gardé par morceaux de 2 Mo
const RETENTION_MS = 365 * 24 * 3600 * 1000; // conservation : 12 mois
const STALE_UPLOAD_MS = 24 * 3600 * 1000;
// Les adultes (demandes de coaching) ont une place limitée, pour qu'une inscription ouverte à tous ne puisse jamais remplir le stockage du club
const adultUserBytes = () => (Number(process.env.ADULT_QUOTA_MB) || 100) * 1024 * 1024; // par adulte
const adultTotalBytes = () => Math.floor(quotaBytes() * ((Number(process.env.ADULT_SHARE_PERCENT) || 40) / 100)); // pour tous les adultes ensemble
const quotaBytes = () => (Number(process.env.VIDEO_QUOTA_MB) || 350) * 1024 * 1024;

// Reconnaît le vrai format du fichier (et pas seulement son nom) : MP4/MOV ou WebM.
export function sniffVideo(head: Buffer): string | null {
  if (head.length >= 12 && head.subarray(4, 8).toString("latin1") === "ftyp") return head.subarray(8, 12).toString("latin1") === "qt  " ? "video/quicktime" : "video/mp4";
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return "video/webm";
  return null;
}

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 700 * 1024;
// Tracés d'une image annotée : on ne garde que des nombres, des couleurs et des textes courts (jamais de code)
const EDIT_TOOLS = ["line", "arrow", "circle", "free", "angle", "text"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
function cleanEdit(body: unknown) {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || JSON.stringify(b).length > 90_000) throw new BadRequestException("Tracés invalides");
  if (!finite(b.w) || !finite(b.h) || b.w <= 0 || b.h <= 0 || b.w > 4000 || b.h > 4000) throw new BadRequestException("Tracés invalides");
  if (!Array.isArray(b.shapes) || b.shapes.length > 60) throw new BadRequestException("Trop de tracés (60 au maximum).");
  const shapes = b.shapes.map((s: any) => {
    if (!s || !EDIT_TOOLS.includes(s.tool) || typeof s.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(s.color)) throw new BadRequestException("Tracé invalide");
    if (!Array.isArray(s.pts) || s.pts.length < 1 || s.pts.length > 600 || s.pts.some((p: unknown) => !Array.isArray(p) || p.length !== 2 || !finite(p[0]) || !finite(p[1]))) throw new BadRequestException("Tracé invalide");
    const size = s.size === undefined ? 1 : s.size;
    if (!finite(size) || size < 0.1 || size > 5) throw new BadRequestException("Tracé invalide");
    if (s.text !== undefined && (typeof s.text !== "string" || s.text.length > 200)) throw new BadRequestException("Texte trop long (200 caractères maximum).");
    return { tool: s.tool, color: s.color, pts: s.pts.map((p: number[]) => [p[0], p[1]]), size, ...(s.text !== undefined ? { text: s.text } : {}) };
  });
  let skeleton: Record<string, number[]> | null = null;
  if (b.skeleton != null) {
    const sk = b.skeleton as Record<string, unknown>;
    const keys = typeof sk === "object" ? Object.keys(sk) : [];
    if (keys.length > 40 || keys.some((k) => !/^[a-zA-Z]{2,20}$/.test(k) || !Array.isArray(sk[k]) || (sk[k] as unknown[]).length !== 2 || !finite((sk[k] as number[])[0]) || !finite((sk[k] as number[])[1]))) throw new BadRequestException("Squelette invalide");
    skeleton = Object.fromEntries(keys.map((k) => [k, [(sk[k] as number[])[0], (sk[k] as number[])[1]]]));
  }
  return { w: b.w, h: b.h, shapes, skeleton, guides: b.guides !== false, measures: b.measures !== false };
}
function sniffImage(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  return null;
}

// Commentaire audio : 2 Mo au maximum, le vrai format est vérifié (webm / ogg / mp4 / wav)
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 300;
function sniffAudio(b: Buffer): string | null {
  if (b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (b.length > 4 && b.subarray(0, 4).toString("latin1") === "OggS") return "audio/ogg";
  if (b.length > 12 && b.subarray(4, 8).toString("latin1") === "ftyp") return "audio/mp4";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WAVE") return "audio/wav";
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
    if (v.fromCoach && !v.sentToPlayerAt && !isStaff(user)) throw new NotFoundException("Vidéo introuvable"); // brouillon du coach : le joueur et sa famille ne le voient pas encore
    if (user.role === Role.ADULT) { if (v.ownerId === user.id && !v.playerId) return v; throw new NotFoundException("Vidéo introuvable"); }
    if (v.playerId && (await this.prisma.playerAccess.findUnique({ where: { userId_playerId: { userId: user.id, playerId: v.playerId } } }))) return v;
    throw new NotFoundException("Vidéo introuvable");
  }
  private async imageConsent(playerId: string) {
    return !!(await this.prisma.consent.findFirst({ where: { playerId, kind: ConsentKind.IMAGE, withdrawnAt: null } }));
  }

  private async usedBytes() {
    const [v, i, a] = await Promise.all([this.prisma.video.aggregate({ _sum: { sizeBytes: true } }), this.prisma.videoImage.aggregate({ _sum: { sizeBytes: true, sourceBytes: true } }), this.prisma.videoAudio.aggregate({ _sum: { sizeBytes: true } })]);
    return (v._sum.sizeBytes ?? 0) + (i._sum.sizeBytes ?? 0) + (i._sum.sourceBytes ?? 0) + (a._sum.sizeBytes ?? 0);
  }

  // ----- Envoi en trois temps : annoncer, envoyer les morceaux, terminer -----
  async create(user: AuthUser, dto: CreateVideoDto) {
    let ownerId: string | null = null, playerId: string | null = null;
    if (user.role === Role.ADULT) {
      if (dto.playerId) throw new ForbiddenException("Accès non autorisé");
      ownerId = user.id;
      if ((await this.prisma.video.count({ where: { ownerId } })) >= 10) throw new BadRequestException("Tu as déjà 10 vidéos : supprime-en une avant d'en ajouter.");
      const mine = (await this.prisma.video.aggregate({ where: { ownerId }, _sum: { sizeBytes: true } }))._sum.sizeBytes ?? 0;
      if (mine + dto.sizeBytes > adultUserBytes()) throw new BadRequestException(`Tu as atteint ta place de stockage (${Math.round(adultUserBytes() / 1024 / 1024)} Mo) : supprime une vidéo avant d'en ajouter.`);
      const allAdults = (await this.prisma.video.aggregate({ where: { ownerId: { not: null }, playerId: null }, _sum: { sizeBytes: true } }))._sum.sizeBytes ?? 0;
      if (allAdults + dto.sizeBytes > adultTotalBytes()) throw new HttpException("La place réservée aux vidéos d'adultes est pleine pour le moment. Préviens le coach.", 507);
    } else {
      if (!dto.playerId) throw new BadRequestException("Choisis le joueur concerné.");
      if (user.role !== Role.COACH && !(await this.prisma.playerAccess.findUnique({ where: { userId_playerId: { userId: user.id, playerId: dto.playerId } } }))) throw new NotFoundException("Fiche introuvable");
      if (!(await this.prisma.player.findUnique({ where: { id: dto.playerId }, select: { id: true } }))) throw new NotFoundException("Fiche introuvable");
      // Accord obligatoire : pas de vidéo d'un jeune sans l'autorisation « droit à l'image » des parents.
      if (!(await this.imageConsent(dto.playerId))) throw new ForbiddenException("L'accord des parents « droit à l'image » n'est pas enregistré : aucune vidéo ne peut être ajoutée.");
      playerId = dto.playerId;
    }
    const fromCoach = isStaff(user) && !!playerId; // le coach envoie une vidéo au joueur
    const used = await this.usedBytes();
    if (used + dto.sizeBytes > quotaBytes()) throw new HttpException("L'espace de stockage du club est plein. Préviens le coach.", 507);
    const chunkCount = Math.ceil(dto.sizeBytes / CHUNK_SIZE);
    const v = await this.prisma.video.create({ data: { title: dto.title, shot: dto.shot, question: dto.question ?? "", sizeBytes: dto.sizeBytes, chunkCount, ownerId, playerId, fromCoach } });
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
  // Alerte : une personne qui ouvre beaucoup de vidéos différentes en peu de temps (compte volé ?) est notée dans le journal.
  private readonly recentOpens = new Map<string, Map<string, number>>();
  private async watchOpens(userId: string, videoId: string) {
    const now = Date.now(), limit = Number(process.env.VIDEO_BULK_ALERT) || 15;
    const mine = this.recentOpens.get(userId) ?? new Map<string, number>();
    for (const [k, t] of mine) if (now - t > 10 * 60_000) mine.delete(k);
    mine.set(videoId, now); this.recentOpens.set(userId, mine);
    if (this.recentOpens.size > 5000) this.recentOpens.clear();
    if (mine.size >= limit) { mine.clear(); await this.audit.log(userId, "video-bulk-view", "Video", videoId); }
  }

  async readRange(user: AuthUser, id: string, header?: string) {
    const v = await this.load(user, id);
    if (!v.complete) throw new NotFoundException("Vidéo introuvable");
    if (!header || /^bytes=0-/.test(header.trim())) await this.watchOpens(user.id, id); // une « ouverture » = lecture depuis le début
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
  private summary(v: Video & { player?: { id: string; firstName: string } | null; owner?: { id: string; firstName: string | null; lastName?: string | null; birthYear?: number | null; level?: string | null; phone?: string | null; email: string } | null; analyses?: any[]; goals?: { goalId: string }[]; images?: { id: string; note: string; editable?: boolean }[]; audio?: { seconds: number } | null; _count?: { messages: number } }, user?: AuthUser) {
    const a = v.analyses?.[0];
    const coach = !!user && isStaff(user);
    const visible = a && (coach || a.sentAt);
    return {
      id: v.id, title: v.title, shot: v.shot, question: v.question, status: v.status, sizeBytes: v.sizeBytes, mimeType: v.mimeType, complete: v.complete,
      recordedAt: v.recordedAt, deleteAfter: v.deleteAfter, seenAt: v.seenAt,
      kind: v.playerId ? "centre" : "coaching",
      fromCoach: v.fromCoach,
      draft: v.fromCoach && !v.sentToPlayerAt,
      player: v.player ? { id: v.player.id, firstName: v.player.firstName } : null,
      owner: coach && v.owner ? { id: v.owner.id, firstName: v.owner.firstName, lastName: v.owner.lastName ?? null, birthYear: v.owner.birthYear ?? null, level: v.owner.level ?? null, phone: v.owner.phone ?? null, email: v.owner.email } : null,
      analysis: visible ? this.analysisOut(a, coach) : null,
      // missions rattachées : le joueur ne les voit que quand la vidéo lui est visible (analyse envoyée, ou vidéo du coach envoyée)
      goalIds: coach || a?.sentAt || (v.fromCoach && !!v.sentToPlayerAt) ? (v.goals ?? []).map((g) => g.goalId) : [],
      images: coach || a?.sentAt ? (v.images ?? []).map((i) => ({ id: i.id, note: i.note, ...(coach ? { editable: !!i.editable } : {}) })) : [],
      audio: v.audio && (coach || a?.sentAt || (v.fromCoach && !!v.sentToPlayerAt)) ? { seconds: v.audio.seconds } : null,
      messageCount: v._count?.messages ?? 0,
    };
  }
  private analysisOut(a: any, staff = false) {
    return { id: a.id, observation: a.observation, strengths: a.strengths, improve: a.improve, exercises: a.exercises, sentAt: a.sentAt, goalIds: (a.goals ?? []).map((g: any) => g.goalId), ...(staff ? { authorName: a.authorName, authorRole: a.authorRole } : {}) };
  }
  private readonly include = { player: { select: { id: true, firstName: true } }, owner: { select: { id: true, firstName: true, lastName: true, birthYear: true, level: true, phone: true, email: true } }, goals: { select: { goalId: true } }, analyses: { include: { goals: true }, orderBy: { createdAt: "desc" as const }, take: 1 }, images: { select: { id: true, note: true, editable: true }, orderBy: { createdAt: "asc" as const } }, audio: { select: { seconds: true } }, _count: { select: { messages: true } } };

  async list(user: AuthUser) {
    if (user.role === Role.COACH) await this.purgeExpired();
    const where = user.role === Role.COACH ? { complete: true }
      : user.role === Role.ADULT ? { complete: true, ownerId: user.id, playerId: null }
      : { complete: true, player: { accesses: { some: { userId: user.id } } }, ...(isStaff(user) ? {} : { NOT: { fromCoach: true, sentToPlayerAt: null } }) };
    const rows = await this.prisma.video.findMany({ where, include: this.include, orderBy: { recordedAt: "desc" } });
    return rows.map((v) => this.summary(v, user));
  }

  async storage() {
    const used = await this.usedBytes();
    return { usedBytes: used, quotaBytes: quotaBytes(), maxVideoBytes: MAX_VIDEO_BYTES };
  }

  // ----- Détail, discussion -----
  async detail(user: AuthUser, id: string) {
    await this.load(user, id);
    if (isStaff(user)) await this.audit.log(user.id, "view", "Video", id); // journal : le coach a ouvert cette vidéo
    const v = await this.prisma.video.findUniqueOrThrow({ where: { id }, include: this.include });
    const out = this.summary(v, user);
    const talk = isStaff(user) || !!out.analysis?.sentAt;
    const msgs = talk ? await this.prisma.message.findMany({ where: { videoId: id }, orderBy: { createdAt: "asc" } }) : [];
    const authors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(msgs.map((m) => m.authorId))] } }, select: { id: true, role: true } });
    const roleOf = new Map(authors.map((a) => [a.id, a.role]));
    const goals = isStaff(user) && v.playerId ? await this.prisma.goal.findMany({ where: { playerId: v.playerId }, orderBy: { createdAt: "asc" }, select: { id: true, axis: true, title: true, season: true } }) : [];
    const linked = v.playerId && out.goalIds.length ? await this.prisma.goal.findMany({ where: { id: { in: out.goalIds } }, select: { id: true, axis: true, title: true } }) : [];
    return { ...out, messages: msgs.map((m) => ({ id: m.id, text: m.text, createdAt: m.createdAt, fromCoach: roleOf.get(m.authorId) === Role.COACH || roleOf.get(m.authorId) === Role.TRAINER, mine: m.authorId === user.id })), goals, linkedGoals: linked };
  }

  async addMessage(user: AuthUser, id: string, text: string) {
    await this.load(user, id);
    const a = await this.prisma.analysis.findFirst({ where: { videoId: id, sentAt: { not: null } } });
    if (!a) throw new ForbiddenException("La discussion s'ouvre une fois l'analyse envoyée.");
    return this.prisma.message.create({ data: { videoId: id, authorId: user.id, text } }).then((m) => ({ id: m.id }));
  }

  async markSeen(user: AuthUser, id: string) {
    const v = await this.load(user, id);
    if (isStaff(user)) return;
    if (v.fromCoach || (await this.prisma.analysis.findFirst({ where: { videoId: v.id, sentAt: { not: null } } }))) await this.prisma.video.update({ where: { id }, data: { seenAt: new Date() } });
  }

  // ----- Analyse (coach) -----
  async saveAnalysis(user: AuthUser, id: string, dto: AnalysisDto) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    await this.load(user, id); // un entraîneur ne touche qu'aux vidéos de ses jeunes
    const v = await this.prisma.video.findUnique({ where: { id } });
    if (!v || !v.complete) throw new NotFoundException("Vidéo introuvable");
    // Centre de compétition : pas d'exercices correctifs, mais des liens vers les objectifs du joueur. Adultes : l'inverse.
    if (v.playerId && dto.exercises?.length) throw new BadRequestException("Pas d'exercices pour les jeunes du Centre.");
    if (!v.playerId && dto.goalIds?.length) throw new BadRequestException("Les objectifs concernent seulement les jeunes du Centre.");
    if (v.playerId && dto.goalIds?.length) {
      const n = await this.prisma.goal.count({ where: { id: { in: dto.goalIds }, playerId: v.playerId } });
      if (n !== new Set(dto.goalIds).size) throw new BadRequestException("Objectif invalide.");
    }
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true } });
    const data = { authorId: user.id, authorName: me?.firstName || (user.role === Role.COACH ? "Coach" : "Entraîneur"), authorRole: user.role as string, observation: dto.observation ?? "", strengths: dto.strengths ?? "", improve: dto.improve ?? "", exercises: (dto.exercises ?? []).map((e) => e.trim()).filter(Boolean) };
    const existing = await this.prisma.analysis.findFirst({ where: { videoId: id } });
    const a = existing ? await this.prisma.analysis.update({ where: { id: existing.id }, data }) : await this.prisma.analysis.create({ data: { videoId: id, playerId: v.playerId, ...data } });
    if (dto.goalIds) {
      await this.prisma.analysisGoal.deleteMany({ where: { analysisId: a.id } });
      if (dto.goalIds.length) await this.prisma.analysisGoal.createMany({ data: [...new Set(dto.goalIds)].map((goalId) => ({ analysisId: a.id, goalId })) });
      if (v.playerId) await this.replaceVideoGoals(id, dto.goalIds);
    }
    if (v.playerId) await this.prisma.player.update({ where: { id: v.playerId }, data: { lastActivityAt: new Date() } });
    return { id: a.id };
  }

  private async replaceVideoGoals(videoId: string, goalIds: string[]) {
    await this.prisma.videoGoal.deleteMany({ where: { videoId } });
    const ids = [...new Set(goalIds)];
    if (ids.length) await this.prisma.videoGoal.createMany({ data: ids.map((goalId) => ({ videoId, goalId })) });
  }

  // Rattacher la vidéo à des missions du joueur (coach, ou entraîneur de ce joueur) : le joueur la retrouve en cliquant sur la mission
  async setGoals(user: AuthUser, id: string, goalIds: string[]) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    await this.load(user, id);
    const v = await this.prisma.video.findUnique({ where: { id } });
    if (!v || !v.complete) throw new NotFoundException("Vidéo introuvable");
    if (!v.playerId) throw new BadRequestException("Les missions concernent seulement les jeunes du Centre.");
    const ids = [...new Set(goalIds)];
    if (ids.length && (await this.prisma.goal.count({ where: { id: { in: ids }, playerId: v.playerId } })) !== ids.length) throw new BadRequestException("Mission invalide.");
    await this.replaceVideoGoals(id, ids);
    // garde l'analyse (si elle existe) cohérente avec les missions choisies
    const a = await this.prisma.analysis.findFirst({ where: { videoId: id } });
    if (a) {
      await this.prisma.analysisGoal.deleteMany({ where: { analysisId: a.id } });
      if (ids.length) await this.prisma.analysisGoal.createMany({ data: ids.map((goalId) => ({ analysisId: a.id, goalId })) });
    }
    await this.audit.log(user.id, "video-goals", "Video", id);
    return { goalIds: ids };
  }

  async sendAnalysis(user: AuthUser, id: string) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    const v = await this.load(user, id); // un entraîneur ne touche qu'aux vidéos de ses jeunes
    const a = await this.prisma.analysis.findFirst({ where: { videoId: id } });
    // Vidéo d'un jeune du Centre : « Ce qui est bien » + « Ce qu'on travaille » suffisent (le mot libre est facultatif). Demande de coaching d'un adulte : une observation reste obligatoire.
    const filled = !!a && (v.playerId ? !!((a.strengths.trim() && a.improve.trim()) || a.observation.trim()) : !!a.observation.trim());
    if (!a || !filled) throw new BadRequestException(v.playerId ? "Écris « Ce qui est bien » et « Ce qu'on travaille » avant d'envoyer l'analyse." : "Écris au moins une observation avant d'envoyer l'analyse.");
    await this.prisma.$transaction([
      this.prisma.analysis.update({ where: { id: a.id }, data: { sentAt: a.sentAt ?? new Date() } }),
      this.prisma.video.update({ where: { id }, data: { status: VideoStatus.ANALYSED, ...(a.sentAt ? {} : { seenAt: null }), ...(v.fromCoach && !v.sentToPlayerAt ? { sentToPlayerAt: new Date(), seenAt: null } : {}) } }),
    ]);
    await this.audit.log(user.id, "analysis-send", "Video", id);
  }

  // Vidéo déposée par le coach : brouillon jusqu'à ce qu'il l'envoie au joueur (ou envoie son analyse)
  async sendToPlayer(user: AuthUser, id: string) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    const v = await this.load(user, id);
    if (!v.fromCoach || !v.complete) throw new BadRequestException("Seule une vidéo déposée par le coach pour un joueur peut lui être envoyée.");
    if (v.sentToPlayerAt) return;
    await this.prisma.video.update({ where: { id }, data: { sentToPlayerAt: new Date(), seenAt: null } });
    if (v.playerId) await this.prisma.player.update({ where: { id: v.playerId }, data: { lastActivityAt: new Date() } });
    await this.audit.log(user.id, "video-send-player", "Video", id);
  }

  // ----- Images annotées (studio d'analyse) : ajoutées par le coach, visibles par la personne concernée une fois l'analyse envoyée -----
  private async imageVisible(user: AuthUser, videoId: string) {
    await this.load(user, videoId);
    if (isStaff(user)) return;
    if (!(await this.prisma.analysis.findFirst({ where: { videoId, sentAt: { not: null } } }))) throw new NotFoundException("Image introuvable");
  }
  async addImage(user: AuthUser, id: string, body: unknown, note?: string) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    await this.load(user, id);
    const v = await this.prisma.video.findUnique({ where: { id } });
    if (!v || !v.complete) throw new NotFoundException("Vidéo introuvable");
    if (!Buffer.isBuffer(body) || !body.length) throw new BadRequestException("Image invalide");
    if (body.length > MAX_IMAGE_BYTES) throw new BadRequestException("Image trop lourde (700 Ko maximum).");
    const mime = sniffImage(body);
    if (!mime) throw new BadRequestException("Image invalide (JPEG ou PNG).");
    if ((await this.prisma.videoImage.count({ where: { videoId: id } })) >= MAX_IMAGES) throw new BadRequestException(`${MAX_IMAGES} images au maximum par vidéo : supprime-en une.`);
    const used = await this.usedBytes();
    if (used + body.length > quotaBytes()) throw new HttpException("L'espace de stockage du club est plein.", 507);
    const img = await this.prisma.videoImage.create({ data: { videoId: id, data: Uint8Array.from(body), mimeType: mime, sizeBytes: body.length, note: (note ?? "").slice(0, 300) } });
    await this.audit.log(user.id, "image-add", "Video", id);
    return { id: img.id, note: img.note };
  }
  async imageFile(user: AuthUser, id: string, imageId: string) {
    await this.imageVisible(user, id);
    const img = await this.prisma.videoImage.findFirst({ where: { id: imageId, videoId: id } });
    if (!img) throw new NotFoundException("Image introuvable");
    return { data: Buffer.from(img.data), mime: img.mimeType };
  }
  // ----- Modifier une image annotée après coup : on garde l'image d'origine (sans dessin) et les tracés -----
  private async staffImage(user: AuthUser, id: string, imageId: string) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    await this.load(user, id);
    const img = await this.prisma.videoImage.findFirst({ where: { id: imageId, videoId: id } });
    if (!img) throw new NotFoundException("Image introuvable");
    return img;
  }
  private checkImageBody(body: unknown): Buffer {
    if (!Buffer.isBuffer(body) || !body.length) throw new BadRequestException("Image invalide");
    if (body.length > MAX_IMAGE_BYTES) throw new BadRequestException("Image trop lourde (700 Ko maximum).");
    if (!sniffImage(body)) throw new BadRequestException("Image invalide (JPEG ou PNG).");
    return body;
  }
  private async checkRoom(extra: number) {
    if (extra > 0 && (await this.usedBytes()) + extra > quotaBytes()) throw new HttpException("L'espace de stockage du club est plein.", 507);
  }
  // Remplace l'image annotée (et son commentaire) par une nouvelle version
  async replaceImage(user: AuthUser, id: string, imageId: string, body: unknown, note?: string) {
    const img = await this.staffImage(user, id, imageId);
    const buf = this.checkImageBody(body);
    await this.checkRoom(buf.length - img.sizeBytes);
    await this.prisma.videoImage.update({ where: { id: imageId }, data: { data: Uint8Array.from(buf), mimeType: sniffImage(buf)!, sizeBytes: buf.length, note: (note ?? "").slice(0, 300) } });
    await this.audit.log(user.id, "image-edit", "Video", id);
    return { id: imageId };
  }
  // Garde l'image d'origine, sans dessin
  async putImageSource(user: AuthUser, id: string, imageId: string, body: unknown) {
    const img = await this.staffImage(user, id, imageId);
    const buf = this.checkImageBody(body);
    await this.checkRoom(buf.length - img.sourceBytes);
    await this.prisma.videoImage.update({ where: { id: imageId }, data: { source: Uint8Array.from(buf), sourceBytes: buf.length, editable: img.edit != null } });
    return { id: imageId };
  }
  // Garde les tracés (flèches, textes, squelette…) : rien n'est lu comme du code, ils servent seulement à redessiner l'image
  async putImageEdit(user: AuthUser, id: string, imageId: string, body: unknown) {
    const img = await this.staffImage(user, id, imageId);
    const edit = cleanEdit(body);
    await this.prisma.videoImage.update({ where: { id: imageId }, data: { edit: edit as object, editable: img.source != null } });
    return { id: imageId };
  }
  async imageSource(user: AuthUser, id: string, imageId: string) {
    const img = await this.staffImage(user, id, imageId);
    if (!img.source) throw new NotFoundException("Cette image ne peut pas être modifiée (elle a été faite avant cette option).");
    return { data: Buffer.from(img.source), mime: sniffImage(Buffer.from(img.source)) ?? "image/jpeg" };
  }
  async imageEdit(user: AuthUser, id: string, imageId: string) {
    const img = await this.staffImage(user, id, imageId);
    if (!img.edit) throw new NotFoundException("Cette image ne peut pas être modifiée (elle a été faite avant cette option).");
    return img.edit;
  }
  async removeImage(user: AuthUser, id: string, imageId: string) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    await this.load(user, id);
    const r = await this.prisma.videoImage.deleteMany({ where: { id: imageId, videoId: id } });
    if (!r.count) throw new NotFoundException("Image introuvable");
  }

  // ----- Commentaire audio du coach : visible par la personne concernée une fois l'analyse envoyée (ou tout de suite si le coach envoie une vidéo au joueur) -----
  private async audioVisible(user: AuthUser, videoId: string) {
    const video = await this.load(user, videoId);
    if (isStaff(user) || video.fromCoach) return;
    if (!(await this.prisma.analysis.findFirst({ where: { videoId, sentAt: { not: null } } }))) throw new NotFoundException("Audio introuvable");
  }
  async putAudio(user: AuthUser, id: string, body: unknown, seconds?: string) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    await this.load(user, id);
    const v = await this.prisma.video.findUnique({ where: { id } });
    if (!v || !v.complete) throw new NotFoundException("Vidéo introuvable");
    if (!Buffer.isBuffer(body) || !body.length) throw new BadRequestException("Audio invalide");
    if (body.length > MAX_AUDIO_BYTES) throw new BadRequestException("Audio trop lourd (2 Mo maximum, environ 5 minutes).");
    const mime = sniffAudio(body);
    if (!mime) throw new BadRequestException("Audio invalide (format non reconnu).");
    const old = await this.prisma.videoAudio.findUnique({ where: { videoId: id }, select: { sizeBytes: true } });
    const used = (await this.usedBytes()) - (old?.sizeBytes ?? 0);
    if (used + body.length > quotaBytes()) throw new HttpException("L'espace de stockage du club est plein.", 507);
    const secs = Math.max(0, Math.min(MAX_AUDIO_SECONDS, Math.round(Number(seconds) || 0)));
    const data = { data: Uint8Array.from(body), mimeType: mime, sizeBytes: body.length, seconds: secs, authorId: user.id, createdAt: new Date() };
    await this.prisma.videoAudio.upsert({ where: { videoId: id }, create: { videoId: id, ...data }, update: data });
    await this.audit.log(user.id, "audio-add", "Video", id);
    return { seconds: secs };
  }
  async audioFile(user: AuthUser, id: string, range?: string) {
    await this.audioVisible(user, id);
    const a = await this.prisma.videoAudio.findUnique({ where: { videoId: id } });
    if (!a) throw new NotFoundException("Audio introuvable");
    const all = Buffer.from(a.data); const total = all.length;
    const m = /^bytes=(\d*)-(\d*)$/.exec(range ?? "");
    if (!m) return { data: all, start: 0, end: total - 1, total, mime: a.mimeType, partial: false };
    let start = m[1] === "" ? Math.max(0, total - Number(m[2])) : Number(m[1]);
    let end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), total - 1) : total - 1;
    if (start >= total || start > end) start = 0, end = total - 1;
    return { data: all.subarray(start, end + 1), start, end, total, mime: a.mimeType, partial: true };
  }
  async removeAudio(user: AuthUser, id: string) {
    if (!isStaff(user)) throw new ForbiddenException("Réservé au coach");
    await this.load(user, id);
    const r = await this.prisma.videoAudio.deleteMany({ where: { videoId: id } });
    if (!r.count) throw new NotFoundException("Audio introuvable");
    await this.audit.log(user.id, "audio-delete", "Video", id);
  }

  // ----- Suppression -----
  async remove(user: AuthUser, id: string) {
    const v = await this.load(user, id);
    if (!isStaff(user) && v.fromCoach) throw new ForbiddenException("Cette vidéo vient de ton coach : lui seul peut la supprimer.");
    await this.prisma.video.delete({ where: { id } });
    await this.audit.log(user.id, "video-delete", "Video", id);
  }

  // Conservation limitée : les vidéos de plus de 12 mois et les envois jamais terminés sont supprimés.
  async purgeExpired() {
    const now = new Date();
    const a = await this.prisma.video.deleteMany({ where: { deleteAfter: { lt: now } } });
    const b = await this.prisma.video.deleteMany({ where: { complete: false, recordedAt: { lt: new Date(now.getTime() - STALE_UPLOAD_MS) } } });
    const d = await this.prisma.tournamentDoc.deleteMany({ where: { deleteAfter: { lt: now } } }); // programmations de tournoi : 12 mois aussi
    const c = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 365 * 24 * 3600 * 1000) } } }); // le journal est gardé 12 mois
    return { expired: a.count, incomplete: b.count, journal: c.count, tournois: d.count };
  }
}
