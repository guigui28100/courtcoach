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
export interface Goal { id: string; playerId: string; season: string; axis: Axis; title: string; indicator: string; deadline: string | null; progress: number; }
export interface Lesson { id: string; type: string; objective: string; days: string[]; moment: string; message: string; status: "PENDING" | "ACCEPTED" | "REFUSED"; coachReply: string; answeredAt: string | null; seenByMemberAt: string | null; createdAt: string; member?: { id: string; firstName: string | null; email: string }; }

export const fullName = (p: Pick<Player, "firstName" | "lastName">) => [p.firstName, p.lastName].filter(Boolean).join(" ") || "Joueur";
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
// Saison sportive : de septembre à août (ex. « 2026-2027 »)
export function currentSeason(d = new Date()) { const y = d.getFullYear(); return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`; }
