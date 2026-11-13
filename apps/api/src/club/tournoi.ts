import { BadRequestException } from "@nestjs/common";

// Tournoi amical d'une animation : on ne garde QUE les réglages et les scores, avec des prénoms (jamais de nom de famille ni de donnée sur un enfant autre que son prénom).
// Le contenu est du JSON reçu du site : on le reconstruit champ par champ au lieu de le garder tel quel.
const int = (v: unknown, min: number, max: number, d: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : d; };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const FORMATS = ["poules", "tmc", "ko", "ladder"];
const MODES = ["jeux", "points", "temps"];
const PAIRS = ["hasard", "equi", "libre", "manuel"];

export function sanitizeTournoi(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Tournoi invalide.");
  const r = raw as Record<string, unknown>;
  const names = Array.isArray(r.names) ? r.names.slice(0, 200).map((x) => str(x, 40)) : [];
  const scores: Record<string, { a: string; b: string }> = {};
  if (r.scores && typeof r.scores === "object" && !Array.isArray(r.scores)) {
    const entries = Object.entries(r.scores as Record<string, unknown>).slice(0, 1200);
    for (const [k, v] of entries) {
      if (!/^[A-Za-z0-9_.:-]{1,40}$/.test(k) || !v || typeof v !== "object") continue;
      const o = v as Record<string, unknown>;
      const digits = (x: unknown) => (typeof x === "string" || typeof x === "number" ? String(x).replace(/\D/g, "").slice(0, 2) : "");
      scores[k] = { a: digits(o.a), b: digits(o.b) };
    }
  }
  const optIn = r.opt && typeof r.opt === "object" ? (r.opt as Record<string, unknown>) : {};
  const ints = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max).map((x) => int(x, 0, 999, 0)) : []);
  const out: Record<string, unknown> = {
    dbl: r.dbl === true,
    n: int(r.n, 3, 200, 11),
    courts: int(r.courts, 1, 12, 2),
    dur: int(r.dur, 1, 300, 38),
    avail: Math.min(12, Math.max(0.5, Number(r.avail) || 3)),
    plan: Array.isArray(r.plan) && r.plan.length > 1
      ? r.plan.slice(0, 5).map((q: unknown) => {
          const o = q && typeof q === "object" ? (q as Record<string, unknown>) : {};
          return { c: int(o.c, 1, 12, 2), h: Math.min(12, Math.max(0.5, Math.round((Number(o.h) || 1) * 2) / 2)) };
        })
      : null,
    start: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(r.start)) ? String(r.start) : "14:00",
    fmt: FORMATS.includes(String(r.fmt)) ? r.fmt : "poules",
    mode: MODES.includes(String(r.mode)) ? r.mode : "jeux",
    opt: { jeux: str(optIn.jeux, 4) || "6", points: str(optIn.points, 4) || "9", temps: str(optIn.temps, 4) || "20" },
    durManual: r.durManual == null ? null : int(r.durManual, 1, 300, 38),
    ver: int(r.ver, 0, 1_000_000, 0),
    names,
    scores,
    pair: PAIRS.includes(String(r.pair)) ? r.pair : "hasard",
    perm: ints(r.perm, 200),
    pairs: Array.isArray(r.pairs) ? r.pairs.slice(0, 120).map((p) => (Array.isArray(p) ? ints(p, 4) : [])) : [],
    rounds: r.rounds == null ? null : int(r.rounds, 1, 40, 4),
    classif: r.classif === "oui" ? "oui" : "non",
    live: r.live === true,
  };
  if (JSON.stringify(out).length > 60_000) throw new BadRequestException("Tournoi trop gros.");
  return out;
}
