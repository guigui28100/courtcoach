import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Progression des séances : UN document par prof (coach ou entraîneur), gardé dans ClubSetting sous la clé « prog:<id du prof> ».
// Personne d'autre ne peut le lire (la clé vient du compte connecté, jamais de l'adresse). Un groupe est un niveau, un effectif et, pour l'appel, la liste des PRÉNOMS (pas de nom de famille).
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, d: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : d; };
const KINDS = ["bilan", "etape", "jeu", "theme"];
const bilan = (v: unknown) => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 60)) { const n = Math.floor(Number(x)); if (str(k, 60) && n >= 0 && n <= 3) out[str(k, 60)] = n; }
  return out;
};
const DOMS = ["tech", "tact", "phys", "ment"];
const objectives = (v: unknown) => {
  const out: Record<string, string[]> = { tech: [], tact: [], phys: [], ment: [] };
  if (v && typeof v === "object" && !Array.isArray(v)) for (const d of DOMS) { const l = (v as Record<string, unknown>)[d]; if (Array.isArray(l)) out[d] = l.slice(0, 10).map((x) => str(x, 100)).filter(Boolean); }
  return out;
};
const blocks = (v: unknown) => (Array.isArray(v) ? v.slice(0, 8).map((b) => { const x = (b && typeof b === "object" ? b : {}) as Record<string, unknown>; return { n: str(x.n, 30) || "Autre", m: int(x.m, 0, 180, 10), t: str(x.t, 600), ...(["goal", "org", "instr", "ok", "vars", "vigil"] as const).reduce((a, k) => (typeof x[k] === "string" && (x[k] as string).trim() ? { ...a, [k]: str(x[k], 400) } : a), {} as Record<string, string>), ...(typeof x.mat === "string" && x.mat.trim() ? { mat: str(x.mat, 200) } : {}) }; }) : undefined);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REACH = ["oui", "part", "non"];
const after = (v: unknown) => {
  const x = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const reach: Record<string, string> = {}; const r = (x.reach && typeof x.reach === "object" ? x.reach : {}) as Record<string, unknown>;
  for (const d of DOMS) if (typeof r[d] === "string" && REACH.includes(r[d] as string)) reach[d] = r[d] as string;
  return { reach, hard: str(x.hard, 600), wins: str(x.wins, 600), indiv: str(x.indiv, 900), best: str(x.best, 400), rework: str(x.rework, 600) };
};
const diag = (v: unknown) => { const out: Record<string, number> = {}; if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, 60)) { const q = Math.floor(Number(n)); if (/^[a-z]_[a-z]{2}$/.test(k) && q >= 0 && q <= 4) out[k] = q; } return out; };
const textMap = (v: unknown, keys: string[] | null, max: number, count: number) => { const out: Record<string, string> = {}; if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, t] of Object.entries(v as Record<string, unknown>).slice(0, count)) { const kk = str(k, 30); const tt = str(t, max); if (kk && tt && (!keys || keys.includes(kk))) out[kk] = tt; } return out; };
const goals = (v: unknown) => (Array.isArray(v) ? v.slice(0, 24).map((o, i) => { const x = (o && typeof o === "object" ? o : {}) as Record<string, unknown>; let id = str(x.id, 24); if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) id = `o${Date.now().toString(36)}${i}`; return { id, d: DOMS.includes(String(x.d)) ? x.d : "tech", skill: str(x.skill, 120), finding: str(x.finding, 400), expected: str(x.expected, 300), ok: str(x.ok, 400), prio: int(x.prio, 1, 3, 2), evalMode: str(x.evalMode, 300), ...(typeof x.theme === "string" && x.theme.trim() ? { theme: str(x.theme, 60) } : {}) }; }) : []);
const MARKS = ["acquis", "cours", "non"];
const checks = (v: unknown, ids: string[]) => {
  const out: Record<string, unknown> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const at of ["10", "20", "30"]) {
    const c = (v as Record<string, unknown>)[at]; if (!c || typeof c !== "object") continue; const x = c as Record<string, unknown>;
    const marks: Record<string, string> = {}; for (const [k, m] of Object.entries((x.marks && typeof x.marks === "object" ? x.marks : {}) as Record<string, unknown>).slice(0, 30)) if (ids.includes(k) && MARKS.includes(String(m))) marks[k] = String(m);
    out[at] = { text: str(x.text, 900), marks, scores: diag(x.scores) };
  }
  return out;
};
const STATUS = ["p", "a", "r", "e"]; // présent · absent · en retard · excusé
const players = (v: unknown) => { const seen = new Set<string>(); const out: string[] = []; if (Array.isArray(v)) for (const x of v) { const n = str(x, 30); const k = n.toLowerCase(); if (n && !seen.has(k) && out.length < 40) { seen.add(k); out.push(n); } } return out; };
const roll = (v: unknown, names: string[]) => {
  const out: Record<string, Record<string, string>> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [d, day] of Object.entries(v as Record<string, unknown>).sort().reverse().slice(0, 80)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !day || typeof day !== "object" || Array.isArray(day)) continue;
    const row: Record<string, string> = {};
    for (const n of names) { const st = (day as Record<string, unknown>)[n]; if (typeof st === "string" && STATUS.includes(st)) row[n] = st; }
    if (Object.keys(row).length) out[d] = row;
  }
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
    const names = players(o.players);
    return {
      id, name: str(o.name, 60) || "Groupe", level: str(o.level, 60), size: names.length || int(o.size, 0, 60, 0),
      players: names, // prénoms seulement, pour l'appel
      appel: roll(o.appel, names), // { "2026-11-19": { "Léa": "p" | "a" | "e" } } : les 80 dernières séances
      minutes: int(o.minutes, 20, 180, 60),
      bilan: bilan(o.bilan), // niveau de chaque thème au départ : 0 non maîtrisé · 1 en cours · 2 en maîtrise · 3 point fort
      ...(str(o.teacher, 60) ? { teacher: str(o.teacher, 60) } : {}), ...(str(o.age, 40) ? { age: str(o.age, 40) } : {}), ...(str(o.slot, 60) ? { slot: str(o.slot, 60) } : {}), ...(str(o.season, 20) ? { season: str(o.season, 20) } : {}),
      diag: diag(o.diag), diagObs: textMap(o.diagObs, DOMS, 900, 4), playerObs: textMap(o.playerObs, names, 600, 40), // observations par joueur : les clés doivent être des prénoms du groupe
      goals: goals(o.goals), validated: o.validated === true, checks: checks(o.checks, goals(o.goals).map((x) => x.id)),
      notes: str(o.notes, 2000), // « ce qui n'est pas acquis » : du texte libre, SANS nom d'élève (les prénoms vont dans la liste des joueurs)
      sessions: sessions.map((s) => {
        const x = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        return { kind: KINDS.includes(String(x.kind)) ? x.kind : "theme", theme: str(x.theme, 60), title: str(x.title, 120), skills: str(x.skills, 900), fil: str(x.fil, 160), why: str(x.why, 200), note: str(x.note, 600), done: x.done === true, ...([1, 2, 3].includes(Number(x.rating)) ? { rating: Number(x.rating) } : {}), ...(x.redo === true ? { redo: true } : {}), ...(x.obj ? { obj: objectives(x.obj) } : {}), ...(Array.isArray(x.blocks) ? { blocks: blocks(x.blocks) } : {}), ...(typeof x.mat === "string" && x.mat.trim() ? { mat: str(x.mat, 200) } : {}), ...(typeof x.date === "string" && DATE.test(x.date) ? { date: x.date } : {}), ...(x.ready === true ? { ready: true } : {}), ...(Array.isArray(x.gl) ? { gl: x.gl.slice(0, 12).map((k) => str(k, 24)).filter((k) => /^[A-Za-z0-9_-]{1,24}$/.test(k)) } : {}), ...(x.after ? { after: after(x.after) } : {}) };
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
