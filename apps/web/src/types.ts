export type Role = "COACH" | "TRAINER" | "ADULT" | "GUARDIAN" | "YOUTH";
export interface Me { id: string; email: string; role: Role; firstName: string | null; mustChangePassword?: boolean; twoFactor?: boolean; accesses: { playerId: string; relation: string }[]; }
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
export type GoalStatus = "ACHIEVED" | "IN_PROGRESS" | "NOT_ACHIEVED";
export const STATUS: Record<GoalStatus, { label: string; emoji: string; bg: string; ink: string }> = {
  ACHIEVED: { label: "Atteint", emoji: "✅", bg: "#dcf247", ink: "#10203a" },
  IN_PROGRESS: { label: "En cours", emoji: "🔄", bg: "#e7e0ff", ink: "#4c1d95" },
  NOT_ACHIEVED: { label: "Pas atteint", emoji: "❌", bg: "#ffe2dc", ink: "#8f1d12" },
};
export interface GoalCheckpoint { authorId?: string | null; authorName?: string | null; authorRole?: string | null; trimester: number; status: GoalStatus; progress: number; comment: string; }
export interface Goal { targetStars?: number; authorId?: string | null; authorName?: string | null; authorRole?: string | null; id: string; playerId: string; season: string; axis: Axis; title: string; indicator: string; deadline: string | null; progress: number; trimesters: number[]; checkpoints: GoalCheckpoint[]; }
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
export interface Evaluation { authorId?: string | null; authorName?: string | null; authorRole?: string | null; id: string; playerId: string; season: string; trimester: number; ratings: Record<string, number>; comments: Record<string, string>; strengths: string; improve: string; next: string; appreciation: string; updatedAt: string; }
export interface MatchRow { opponentRanking?: string | null; authorId?: string | null; authorName?: string | null; authorRole?: string | null; id: string; playerId: string; date: string; tournament: string; round: string; result: "Victoire" | "Défaite"; score: string; remark: string; }

export const TRIMESTER_MONTHS = ["début de saison", "septembre – décembre", "janvier – mars", "avril – août"];
// t = 0 : bilan de début d'année (point de départ de la saison) ; 1 à 3 : bulletin du trimestre
export const periodLabel = (season: string, t: number) => `${t === 0 ? "Bilan de début d'année" : `Trimestre ${t}`} · saison ${season.replace("-", "/")}`;
export const periodShort = (season: string, t: number) => (t === 0 ? "Départ" : `T${t} ${season.replace("-", "/")}`);
// L'auto-évaluation du jeune s'ouvre à la fin de chaque trimestre : 1er décembre (T1), 1er mars (T2), 1er juin (T3). Les périodes passées restent ouvertes.
export const SELF_EVAL_MONTH: Record<number, string> = { 1: "décembre", 2: "mars", 3: "juin" };
export function selfEvalOpensOn(season: string, t: number) { const y = Number(season.slice(0, 4)); return new Date(Date.UTC(t === 1 ? y : y + 1, t === 1 ? 11 : t === 2 ? 2 : 5, 1)); }
export const selfEvalIsOpen = (season: string, t: number, now = new Date()) => now >= selfEvalOpensOn(season, t);
// Premier bulletin ouvert et pas encore envoyé (celui qu'il faut remplir maintenant), sinon null
export const pendingSelfEval = (list: { season: string; trimester: number; sentAt: string | null }[], season: string, now = new Date()) =>
  [1, 2, 3].find((t) => selfEvalIsOpen(season, t, now) && !list.some((e) => e.season === season && e.trimester === t && e.sentAt)) ?? null;
export function trimesterOf(d = new Date()) { const m = d.getMonth(); return m >= 8 ? 1 : m <= 2 ? 2 : 3; }
// Trimestre précédent (pour comparer)
// Période précédente : T3 → T2 → T1 → bilan de départ (0) de la même saison ; le bilan de départ se compare au dernier trimestre de la saison d'avant.
export function previousPeriod(season: string, t: number) { if (t >= 1) return { season, t: t - 1 }; const y = Number(season.slice(0, 4)); return { season: `${y - 1}-${y}`, t: 3 }; }
// Une date de match appartient à quel trimestre ?
export const inPeriod = (iso: string, season: string, t: number) => { const d = new Date(iso); return currentSeason(d) === season && trimesterOf(d) === t; };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
// Bilan de départ simple : une note par domaine (rangée sous la clé du domaine) ; sinon moyenne des compétences notées
export const axisAverage = (ev: Pick<Evaluation, "ratings"> | undefined, axis: EvalAxis) => ev?.ratings?.[axis.key] || mean(axis.skills.map(([k]) => ev?.ratings?.[k]).filter((v): v is number => !!v));
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
export interface AnalysisOut { authorId?: string | null; authorName?: string | null; authorRole?: string | null; id: string; observation: string; strengths: string; improve: string; exercises: string[]; sentAt: string | null; goalIds: string[]; }
export interface VideoRow {
  id: string; title: string; shot: string; question: string; status: "WAITING" | "ANALYSED" | "REFERENCE" | "FOLLOW_UP"; sizeBytes: number; recordedAt: string; deleteAfter: string | null; seenAt: string | null;
  kind: "coaching" | "centre"; fromCoach: boolean; images: { id: string; note: string }[]; player: { id: string; firstName: string } | null; owner: { id: string; firstName: string | null; email: string } | null; analysis: AnalysisOut | null; messageCount: number;
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

// Bilan de l'objectif au trimestre t (atteint / en progrès / pas atteint) ; null = pas encore évalué
export const statusAt = (g: Pick<Goal, "checkpoints">, t: number): GoalStatus | null => checkpointAt(g, t)?.status ?? null;
// Objectif reconduit : déjà à travailler au trimestre d'avant, où il n'avait pas été atteint
export const isCarriedOver = (g: Pick<Goal, "trimesters" | "checkpoints">, t: number) => t > 1 && goalApplies(g, t) && goalApplies(g, t - 1) && !!checkpointAt(g, t - 1) && statusAt(g, t - 1) !== "ACHIEVED";
// Les trimestres où un objectif est à travailler, écrits en toutes lettres (vide = toute la saison = 1, 2 et 3)
export const trimestersOf = (g: Pick<Goal, "trimesters">) => (g.trimesters?.length ? g.trimesters : [1, 2, 3]);

// ----- Auto-évaluation du jeune (fin de trimestre) : surtout des choix pré-enregistrés -----
export interface SelfEvaluation { id: string; playerId: string; season: string; trimester: number; mood: number | null; ratings: Record<string, number>; goals: Record<string, GoalStatus>; proud: string[]; improve: string[]; wish: string[]; comment: string; sentAt: string | null; readAt: string | null; updatedAt: string; }
export const MOODS = [["😟", "Très dur"], ["😕", "Pas terrible"], ["🙂", "Plutôt bien"], ["😀", "Très bien"], ["🤩", "Génial"]] as const;
export type Preset = [id: string, label: string];
export const SELF_PRESETS: { proud: Preset[]; improve: Preset[]; wish: Preset[] } = {
  proud: [["service", "Mon service est plus régulier"], ["coup-droit", "Mon coup droit progresse"], ["revers", "Mon revers progresse"], ["filet", "Je suis plus à l'aise au filet"], ["deplacements", "Je me déplace mieux"], ["match", "J'ai bien joué en match"], ["calme", "Je reste calme quand c'est difficile"], ["assidu", "Je suis venu à presque tous les entraînements"], ["equipe", "J'aide mes partenaires"], ["physique", "Je tiens mieux physiquement"], ["resultats-tournois", "Mes résultats en tournois"]],
  improve: [["service", "Mon service"], ["coup-droit", "Mon coup droit"], ["revers", "Mon revers"], ["retour", "Mon retour de service"], ["deplacements", "Mes déplacements"], ["tactique", "Mes choix pendant le match"], ["calme", "Rester calme quand je rate"], ["concentration", "Ma concentration"], ["endurance", "Mon endurance"], ["confiance", "Ma confiance en moi"]],
  wish: [["classement", "Monter au classement"], ["gagner-tournoi", "Gagner un tournoi"], ["plus-tournois", "Faire plus de tournois"], ["amicaux-weekend", "Jouer plus de parties amicales le week-end"], ["continuer", "Continuer comme ça"], ["plus-physique", "Faire plus de physique"]],
};
export const FEELINGS = [["😟", "Difficile"], ["😕", "Pas facile"], ["🙂", "Ça va"], ["😀", "Bien"], ["🤩", "Super"]] as const;
// Anciens choix de « Mon projet » : ils restent lisibles dans les bulletins déjà envoyés
export const SELF_LEGACY: Preset[] = [["match", "Jouer plus de matchs"], ["tournoi", "Faire un tournoi"], ["defis", "Faire plus de petits défis"], ["jeux", "Plus de jeux pour s'amuser"], ["video", "Que le coach regarde mes vidéos"], ["physique", "Un peu plus de physique"], ["service", "Travailler encore mon service"], ["copains", "Jouer avec des copains"]];
export const presetLabel = (list: Preset[], id: string) => list.find(([k]) => k === id)?.[1];

// ----- Étoiles de fin de cours (données par le coach : en plus pour dire bravo, en moins pour dire « pas en progrès », toujours avec un commentaire pour les retraits) -----
export interface CourseStar { goalId?: string | null; authorId?: string | null; authorName?: string | null; authorRole?: string | null; id: string; day: string; stars: number; reason: string; domain: string | null; comment: string; }
export const STAR_REASONS: { id: string; emoji: string; label: string; hint: string }[] = [
  { id: "effort", emoji: "💪", label: "Effort", hint: "S'est donné à fond" },
  { id: "ecoute", emoji: "👂", label: "Écoute", hint: "A bien écouté et appliqué les consignes" },
  { id: "progres", emoji: "📈", label: "Progrès", hint: "Un beau progrès pendant le cours" },
  { id: "fairplay", emoji: "🤝", label: "Fair-play", hint: "Beau comportement avec les autres" },
  { id: "equipe", emoji: "👥", label: "Esprit d'équipe", hint: "A aidé ou encouragé ses partenaires" },
  { id: "courage", emoji: "🦁", label: "Courage", hint: "N'a pas lâché malgré la difficulté" },
  { id: "concentration", emoji: "🎯", label: "Concentration", hint: "Très concentré" },
  { id: "bonne-humeur", emoji: "😄", label: "Bonne humeur", hint: "A mis de la joie dans le groupe" },
  { id: "etat-d-esprit", emoji: "🧠", label: "État d'esprit", hint: "Positif, ouvert, prêt à apprendre" },
  { id: "motivation", emoji: "🔥", label: "Motivation", hint: "Envie de bien faire et d'avancer" },
  { id: "assiduite", emoji: "⏰", label: "Assiduité", hint: "Présent, à l'heure, régulier" },
  { id: "attitude", emoji: "🤝", label: "Attitude", hint: "Respect, écoute, fair-play" },
  { id: "concentration-objectifs", emoji: "🎯", label: "Concentration sur ses objectifs", hint: "Reste concentré sur ses missions pendant le cours" },
];
// « Pas en progrès » : ce qui peut faire perdre des étoiles (le jeune voit toujours l'explication)
export const STAR_NEG_REASONS: { id: string; emoji: string; label: string; hint: string }[] = [
  { id: "neg-comportement", emoji: "🚧", label: "Comportement", hint: "Un comportement à reprendre" },
  { id: "neg-attitude", emoji: "😐", label: "Attitude", hint: "Une attitude à changer" },
  { id: "neg-concentration", emoji: "🌫️", label: "Concentration", hint: "Pas assez concentré" },
  { id: "neg-ecoute", emoji: "🙉", label: "Écoute", hint: "Les consignes n'ont pas été suivies" },
  { id: "neg-technique", emoji: "🎾", label: "Technique", hint: "La technique n'a pas été travaillée" },
  { id: "neg-objectifs", emoji: "🎯", label: "Objectifs", hint: "Les objectifs n'ont pas été travaillés" },
  { id: "neg-effort", emoji: "💤", label: "Effort", hint: "Pas assez d'effort" },
  { id: "neg-fairplay", emoji: "🤝", label: "Fair-play", hint: "Un manque de respect ou de fair-play" },
  { id: "neg-assiduite", emoji: "⏰", label: "Assiduité", hint: "Retard ou absence" },
  { id: "neg-etat-d-esprit", emoji: "🌧️", label: "État d'esprit", hint: "Un état d'esprit à changer" },
  { id: "neg-motivation", emoji: "🪫", label: "Motivation", hint: "Peu d'envie aujourd'hui" },
  { id: "neg-concentration-objectifs", emoji: "🌫️", label: "Concentration sur ses objectifs", hint: "Peu concentré sur ses missions" },
];
export const starReason = (id: string) => STAR_REASONS.find((r) => r.id === id) ?? STAR_NEG_REASONS.find((r) => r.id === id);
export const isNegReason = (id: string) => id.startsWith("neg-");
// Total : les étoiles en moins se soustraient, mais le total ne descend jamais sous zéro
export const totalStars = (list: Pick<CourseStar, "stars">[]) => Math.max(0, list.reduce((n, s) => n + s.stars, 0));
// Radar « de tous les jours » : chaque étoile fait grandir un domaine ; 30 étoiles dans le trimestre = domaine plein (5 sur 5) ; il repart de zéro à chaque trimestre
export const STARS_FOR_FULL = 30;
export const DOMAIN_EMOJI: Record<string, string> = { technique: "🎾", tactique: "🧠", physique: "💪", mental: "🔥", attitude: "🤝" };
export function starsByDomain(list: Pick<CourseStar, "day" | "stars" | "domain">[], season = currentSeason(), t = trimesterOf()) {
  const out: Record<string, number> = {}; EVAL_AXES.forEach((a) => { out[a.key] = 0; });
  list.forEach((s) => { if (s.domain && s.domain in out && inPeriod(s.day + "T12:00:00", season, t)) out[s.domain] += s.stars; });
  for (const k of Object.keys(out)) out[k] = Math.max(0, out[k]); // un domaine ne descend jamais sous zéro
  return out;
}
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const fmtDay = (day: string) => new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

// ----- Matchs déclarés par le jeune (choix proposés, jamais de nom d'adversaire) -----
export interface DeclaredMatch { id: string; day: string; kind: string; event: string; result: "Victoire" | "Défaite"; score: string; opponent: string; feeling: number; wellDone: string[]; toImprove: string | null; opponentRanking?: string | null; coachComment: string; editable: boolean; editableUntil: string; }
export const MATCH_KINDS: [string, string][] = [["tournoi", "🏆 Tournoi"], ["plateau", "🎾 Plateau"], ["equipes", "👥 Championnat par équipes"], ["amical", "🤝 Match amical"], ["entrainement", "🏋️ Match d'entraînement"]];
export const MATCH_OPPONENTS: [string, string][] = [["plus-fort", "💪 Plus fort que moi"], ["pareil", "⚖️ Du même niveau"], ["moins-fort", "🌱 Moins fort que moi"]];
export const MATCH_SKILLS: [string, string][] = [["service", "Mon service"], ["coup-droit", "Mon coup droit"], ["revers", "Mon revers"], ["retour", "Mon retour de service"], ["volee", "Mon jeu au filet"], ["deplacements", "Mes déplacements"], ["calme", "Mon calme"], ["tactique", "Mes choix tactiques"], ["physique", "Mon physique"], ["combativite", "Ma combativité"], ["concentration", "Ma concentration"]];
export const matchLabel = (list: [string, string][], id: string | null) => list.find(([k]) => k === id)?.[1] ?? id ?? "";

// Classements de tennis, du plus bas au plus haut : sert à trouver « le classement le plus élevé battu »
export const RANKINGS = ["NC", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15", "-30"];
export function matchStats(ms: { result: string; opponentRanking?: string | null }[]) {
  const wins = ms.filter((m) => m.result === "Victoire");
  const beaten = wins.map((m) => m.opponentRanking).filter((r): r is string => !!r && RANKINGS.includes(r));
  const best = beaten.length ? beaten.reduce((a, b) => (RANKINGS.indexOf(b) > RANKINGS.indexOf(a) ? b : a)) : null;
  return { played: ms.length, wins: wins.length, losses: ms.length - wins.length, bestBeaten: best, rankedWins: beaten.length };
}

// ----- Missions : étoiles gagnées sur la mission pendant le trimestre → pourcentage qui aide le coach à décider « atteinte » ou « non atteinte » -----
export const missionStars = (stars: Pick<CourseStar, "day" | "stars" | "goalId">[], goalId: string, season: string, t: number) =>
  Math.max(0, stars.filter((x) => x.goalId === goalId && inPeriod(x.day + "T12:00:00", season, t)).reduce((n, x) => n + x.stars, 0));
export const missionPercent = (earned: number, target = 10) => Math.min(100, Math.round((earned / Math.max(1, target)) * 100));

// ----- Les deux qualités : des étoiles comme les autres (attitude, concentration sur ses objectifs) -----
export type QualityKey = "attitude" | "objectives";
export const QUALITIES: { key: QualityKey; label: string; emoji: string; hint: string; reason: string; domain: string }[] = [
  { key: "attitude", label: "Attitude", emoji: "🤝", hint: "Respect, écoute, fair-play", reason: "attitude", domain: "attitude" },
  { key: "objectives", label: "Concentration sur ses objectifs", emoji: "🎯", hint: "Reste concentré sur ses missions pendant le cours", reason: "concentration-objectifs", domain: "mental" },
];
export const qualityOfReason = (reason: string) => QUALITIES.find((q) => q.reason === reason || "neg-" + q.reason === reason);
// Étoiles gagnées (en plus ou en moins) pour chaque qualité pendant le trimestre
export function qualityStars(stars: Pick<CourseStar, "day" | "stars" | "reason" | "goalId">[], season: string, t: number): { sum: Record<QualityKey, number>; courses: number } {
  const inT = stars.filter((s) => !s.goalId && qualityOfReason(s.reason) && inPeriod(s.day + "T12:00:00", season, t));
  const sum = {} as Record<QualityKey, number>;
  for (const q of QUALITIES) sum[q.key] = inT.filter((s) => qualityOfReason(s.reason)!.key === q.key).reduce((n, s) => n + s.stars, 0);
  return { sum, courses: new Set(inT.map((s) => s.day)).size };
}
