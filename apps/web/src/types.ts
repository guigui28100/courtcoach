export type Role = "COACH" | "ADULT" | "GUARDIAN" | "YOUTH";
export interface Me { id: string; email: string; role: Role; firstName: string | null; mustChangePassword?: boolean; accesses: { playerId: string; relation: string }[]; }
export type Axis = "TECHNIQUE" | "TACTIQUE" | "PHYSIQUE" | "MENTAL";
export const AXES: { key: Axis; label: string; color: string }[] = [
  { key: "TECHNIQUE", label: "Technique", color: "#b8471f" },
  { key: "TACTIQUE", label: "Tactique", color: "#2a6fb0" },
  { key: "PHYSIQUE", label: "Physique", color: "#2f8f5b" },
  { key: "MENTAL", label: "Mental", color: "#7a4cc2" },
];
export interface Player {
  id: string; firstName: string; lastName: string; birthDate: string | null; sex: string | null; club: string | null; licence: string | null;
  heightCm: number | null; ranking: string | null; targetRanking: string | null; hand: string | null; backhand: string | null;
  playStyle: string | null; training: string | null; availability: string | null; health?: string | null; coachNotes?: string | null;
  lastActivityAt: string; consents?: Consent[];
}
export interface Consent { id: string; kind: "PRIVACY_POLICY" | "FOLLOW_UP" | "IMAGE" | "HEALTH" | "ACCOUNT"; givenBy: string; method: string; grantedAt: string; withdrawnAt: string | null; }
export interface GoalCheckpoint { trimester: number; progress: number; comment: string; }
export interface Goal { id: string; playerId: string; season: string; axis: Axis; title: string; indicator: string; deadline: string | null; progress: number; trimesters: number[]; checkpoints: GoalCheckpoint[]; }
export interface Lesson { id: string; type: string; objective: string; days: string[]; moment: string; message: string; status: "PENDING" | "ACCEPTED" | "REFUSED"; coachReply: string; answeredAt: string | null; seenByMemberAt: string | null; createdAt: string; member?: { id: string; firstName: string | null; email: string }; }

export const fullName = (p: Pick<Player, "firstName" | "lastName">) => [p.firstName, p.lastName].filter(Boolean).join(" ") || "Joueur";
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
// Saison sportive : de septembre à août (ex. « 2026-2027 »)
export function currentSeason(d = new Date()) { const y = d.getFullYear(); return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`; }

// ----- Évaluations trimestrielles : 5 axes, 21 compétences notées de 1 à 5 -----
export interface EvalAxis { key: string; label: string; color: string; skills: [string, string][]; }
export const EVAL_AXES: EvalAxis[] = [
  { key: "technique", label: "Technique", color: "#b8471f", skills: [["coup_droit", "Coup droit"], ["revers", "Revers"], ["service", "Service"], ["retour", "Retour de service"], ["volee", "Volée et jeu au filet"], ["deplacements", "Jeu de jambes et placements"]] },
  { key: "tactique", label: "Tactique", color: "#2a6fb0", skills: [["lecture", "Lecture du jeu"], ["construction", "Construction du point"], ["variations", "Variations (hauteur, effets, directions)"], ["choix", "Choix des schémas en match"]] },
  { key: "physique", label: "Physique", color: "#2f8f5b", skills: [["vitesse", "Vitesse et explosivité"], ["endurance", "Endurance"], ["coordination", "Coordination et équilibre"], ["souplesse", "Souplesse et prévention des blessures"]] },
  { key: "mental", label: "Mental", color: "#7a4cc2", skills: [["concentration", "Concentration"], ["emotions", "Gestion des émotions"], ["combativite", "Combativité"], ["confiance", "Confiance et autonomie"]] },
  { key: "attitude", label: "Attitude", color: "#8a6200", skills: [["assiduite", "Assiduité et ponctualité"], ["etat_esprit", "État d'esprit à l'entraînement"], ["esprit_equipe", "Esprit d'équipe et fair-play"]] },
];
export const RATING_LABELS = ["", "À travailler", "En progrès", "Acquis", "Solide", "Point fort"];
export interface Evaluation { id: string; playerId: string; season: string; trimester: number; ratings: Record<string, number>; comments: Record<string, string>; strengths: string; improve: string; next: string; appreciation: string; updatedAt: string; }
export interface MatchRow { id: string; playerId: string; date: string; tournament: string; round: string; result: "Victoire" | "Défaite"; score: string; remark: string; }

export const TRIMESTER_MONTHS = ["", "septembre – décembre", "janvier – mars", "avril – août"];
export const periodLabel = (season: string, t: number) => `Trimestre ${t} · saison ${season.replace("-", "/")}`;
export function trimesterOf(d = new Date()) { const m = d.getMonth(); return m >= 8 ? 1 : m <= 2 ? 2 : 3; }
// Trimestre précédent (pour comparer)
export function previousPeriod(season: string, t: number) { if (t > 1) return { season, t: t - 1 }; const y = Number(season.slice(0, 4)); return { season: `${y - 1}-${y}`, t: 3 }; }
// Une date de match appartient à quel trimestre ?
export const inPeriod = (iso: string, season: string, t: number) => { const d = new Date(iso); return currentSeason(d) === season && trimesterOf(d) === t; };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const axisAverage = (ev: Pick<Evaluation, "ratings"> | undefined, axis: EvalAxis) => mean(axis.skills.map(([k]) => ev?.ratings?.[k]).filter((v): v is number => !!v));
export const overallAverage = (ev: Pick<Evaluation, "ratings"> | undefined) => mean(Object.values(ev?.ratings ?? {}).filter((v) => v > 0));
export const ratedCount = (ev: Pick<Evaluation, "ratings"> | undefined) => Object.values(ev?.ratings ?? {}).filter((v) => v > 0).length;
export const TOTAL_SKILLS = EVAL_AXES.reduce((n, a) => n + a.skills.length, 0);
export const fmtAvg = (v: number) => (v ? v.toFixed(1).replace(".", ",") : "–");
export const trend = (now: number, before: number) => (!now || !before ? "" : now > before + 0.05 ? "▲" : now < before - 0.05 ? "▼" : "=");
// Tendance honnête : on ne compare que les compétences notées aux DEUX trimestres (sinon une évaluation partielle fausse la flèche).
export function trendCommon(ev: Pick<Evaluation, "ratings"> | undefined, prev: Pick<Evaluation, "ratings"> | undefined, axis?: EvalAxis) {
  if (!ev || !prev) return "";
  const keys = (axis ? axis.skills.map(([k]) => k) : Object.keys(ev.ratings)).filter((k) => ev.ratings[k] && prev.ratings[k]);
  if (!keys.length) return "";
  return trend(mean(keys.map((k) => ev.ratings[k])), mean(keys.map((k) => prev.ratings[k])));
}

// ----- Vidéos et analyses -----
export const SHOTS = ["Coup droit", "Revers", "Service", "Retour de service", "Volée", "Smash", "Jeu de jambes", "Autre"];
export interface AnalysisOut { id: string; observation: string; strengths: string; improve: string; exercises: string[]; sentAt: string | null; goalIds: string[]; }
export interface VideoRow {
  id: string; title: string; shot: string; question: string; status: "WAITING" | "ANALYSED" | "REFERENCE" | "FOLLOW_UP"; sizeBytes: number; recordedAt: string; deleteAfter: string | null; seenAt: string | null;
  kind: "coaching" | "centre"; images: { id: string; note: string }[]; player: { id: string; firstName: string } | null; owner: { id: string; firstName: string | null; email: string } | null; analysis: AnalysisOut | null; messageCount: number;
}
export interface VideoMessage { id: string; text: string; createdAt: string; fromCoach: boolean; mine: boolean; }
export interface VideoDetail extends VideoRow { messages: VideoMessage[]; goals: { id: string; axis: string; title: string; season: string }[]; linkedGoals: { id: string; axis: string; title: string }[]; }
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const fmtMo = (b: number) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} Mo`;

// ----- Objectifs par trimestre -----
// Un objectif est « à travailler » au trimestre t s'il n'est pas limité à d'autres trimestres (vide = toute la saison).
export const goalApplies = (g: Pick<Goal, "trimesters">, t: number) => !g.trimesters?.length || g.trimesters.includes(t);
export const checkpointAt = (g: Pick<Goal, "checkpoints">, t: number) => g.checkpoints?.find((c) => c.trimester === t);
// Où en est l'objectif à la fin du trimestre t : le point de contrôle de ce trimestre, sinon le dernier avant (rien n'a bougé depuis) ; null = pas encore suivi.
export function progressAt(g: Pick<Goal, "checkpoints" | "progress">, t: number): number | null {
  const cps = g.checkpoints ?? [];
  if (!cps.length) return g.progress; // objectif créé avant l'historique par trimestre
  return [...cps].filter((c) => c.trimester <= t).sort((a, b) => b.trimester - a.trimester)[0]?.progress ?? null;
}
export function progressBefore(g: Pick<Goal, "checkpoints" | "progress">, t: number): number | null {
  return (g.checkpoints ?? []).length ? progressAt(g, t - 1) : null;
}
