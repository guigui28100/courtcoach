import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Progression des séances : UN document par prof (coach ou entraîneur), gardé dans ClubSetting sous la clé « prog:<id du prof> ».
// Personne d'autre ne peut le lire (la clé vient du compte connecté, jamais de l'adresse). Aucun nom d'élève : un groupe est un niveau et un effectif.
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, d: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : d; };
const KINDS = ["bilan", "etape", "jeu", "theme"];
const bilan = (v: unknown) => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 60)) { const n = Math.floor(Number(x)); if (str(k, 60) && n >= 0 && n <= 3) out[str(k, 60)] = n; }
  return out;
};
export const MAX_GROUPS = 12;
export const MAX_SESSIONS = 40;

export function sanitizeProgression(raw: unknown): { groups: unknown[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Progression invalide.");
  const groups = Array.isArray((raw as { groups?: unknown }).groups) ? ((raw as { groups: unknown[] }).groups) : [];
  if (groups.length > MAX_GROUPS) throw new BadRequestException(`${MAX_GROUPS} groupes au plus.`);
  const seen = new Set<string>();
  const out = groups.map((g, gi) => {
    if (!g || typeof g !== "object") throw new BadRequestException("Groupe invalide.");
    const o = g as Record<string, unknown>;
    let id = str(o.id, 24); if (!/^[A-Za-z0-9_-]{1,24}$/.test(id) || seen.has(id)) id = `g${Date.now().toString(36)}${gi}`;
    seen.add(id);
    const sessions = Array.isArray(o.sessions) ? o.sessions : [];
    if (sessions.length > MAX_SESSIONS) throw new BadRequestException(`${MAX_SESSIONS} séances au plus par groupe.`);
    return {
      id, name: str(o.name, 60) || "Groupe", level: str(o.level, 60), size: int(o.size, 0, 60, 0),
      minutes: int(o.minutes, 20, 180, 60),
      bilan: bilan(o.bilan), // niveau de chaque thème au départ : 0 non maîtrisé · 1 en cours · 2 en maîtrise · 3 point fort
      notes: str(o.notes, 2000), // « ce qui n'est pas acquis » : du texte libre, SANS nom d'élève (l'écran le rappelle)
      sessions: sessions.map((s) => {
        const x = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        return { kind: KINDS.includes(String(x.kind)) ? x.kind : "theme", theme: str(x.theme, 60), title: str(x.title, 120), skills: str(x.skills, 600), exercise: str(x.exercise, 1200), fil: str(x.fil, 160), why: str(x.why, 200), note: str(x.note, 600), done: x.done === true };
      }),
    };
  });
  const value = { groups: out };
  if (JSON.stringify(value).length > 400_000) throw new BadRequestException("Progression trop grosse.");
  return value;
}

@Injectable()
export class ProgressionsService {
  constructor(private readonly prisma: PrismaService) {}
  private key = (userId: string) => `prog:${userId}`;

  async get(userId: string) {
    const row = await this.prisma.clubSetting.findUnique({ where: { key: this.key(userId) } });
    const v = row?.value as { groups?: unknown[]; updatedAt?: string } | null;
    return { groups: v?.groups ?? [], updatedAt: v?.updatedAt ?? null };
  }

  async set(userId: string, raw: unknown) {
    const clean = sanitizeProgression(raw);
    const value = { ...clean, updatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonObject;
    await this.prisma.clubSetting.upsert({ where: { key: this.key(userId) }, update: { value }, create: { key: this.key(userId), value } });
    return { groups: clean.groups, updatedAt: (value as { updatedAt: string }).updatedAt };
  }

  async remove(userId: string) { await this.prisma.clubSetting.deleteMany({ where: { key: this.key(userId) } }); }
}
