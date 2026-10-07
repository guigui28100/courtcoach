import { Axis, ConsentKind, GoalStatus, Role } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ValidateIf, ValidateNested, IsArray, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);
const SEASON = /^\d{4}-\d{4}$/;

export class CreatePlayerDto {
  @Transform(trim) @IsString() @MaxLength(60) firstName: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @MaxLength(20) ranking?: string;
}

export class UpdatePlayerDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @MaxLength(10) sex?: string;
  @IsOptional() @IsString() @MaxLength(80) club?: string;
  @IsOptional() @IsString() @MaxLength(30) licence?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(50) @Max(250) heightCm?: number;
  @IsOptional() @IsString() @MaxLength(20) ranking?: string;
  @IsOptional() @IsString() @MaxLength(20) targetRanking?: string;
  @IsOptional() @IsString() @MaxLength(30) hand?: string;
  @IsOptional() @IsString() @MaxLength(30) backhand?: string;
  @IsOptional() @IsString() @MaxLength(200) playStyle?: string;
  @IsOptional() @IsString() @MaxLength(200) training?: string;
  @IsOptional() @IsString() @MaxLength(200) availability?: string;
  @IsOptional() @IsString() @MaxLength(1000) health?: string;
  @IsOptional() @IsString() @MaxLength(3000) coachNotes?: string;
}

export class ConsentDto {
  @IsEnum(ConsentKind) kind: ConsentKind;
  @Transform(trim) @IsString() @MaxLength(100) givenBy: string; // nom du responsable légal
  @IsIn(["paper", "online"]) method: string;
}

export class InvitationDto {
  @Transform(lower) @IsEmail() @MaxLength(254) email: string;
  @IsIn([Role.GUARDIAN, Role.YOUTH]) role: Role;
}

export class GoalDto {
  @Matches(SEASON) season: string;
  @IsEnum(Axis) axis: Axis;
  @Transform(trim) @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(200) indicator?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsInt({ each: true }) @Min(1, { each: true }) @Max(3, { each: true }) trimesters?: number[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(60) targetStars?: number;
}

export class UpdateGoalDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) indicator?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsInt({ each: true }) @Min(1, { each: true }) @Max(3, { each: true }) trimesters?: number[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(60) targetStars?: number;
}

// Où en est l'objectif à la fin d'un trimestre, et la note du coach
export class CheckpointDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) progress: number;
  @IsOptional() @IsEnum(GoalStatus) status?: GoalStatus;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

export class EvaluationDto {
  @IsOptional() @IsObject() ratings?: Record<string, number>;
  @IsOptional() @IsObject() comments?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(3000) strengths?: string;
  @IsOptional() @IsString() @MaxLength(3000) improve?: string;
  @IsOptional() @IsString() @MaxLength(3000) next?: string;
  @IsOptional() @IsString() @MaxLength(3000) appreciation?: string;
}

// Étoiles de fin de cours : positives (bravo) ou « pas en progrès » (jamais sans explication : le jeune voit toujours le commentaire)
export const STAR_REASONS = ["effort", "ecoute", "progres", "fairplay", "equipe", "courage", "concentration", "bonne-humeur", "etat-d-esprit", "motivation", "assiduite", "attitude"];
export const STAR_NEG_REASONS = ["neg-comportement", "neg-attitude", "neg-concentration", "neg-ecoute", "neg-technique", "neg-objectifs", "neg-effort", "neg-fairplay", "neg-assiduite", "neg-etat-d-esprit", "neg-motivation"];
export const STAR_DOMAINS = ["technique", "tactique", "physique", "mental", "attitude"];
export class StarDto {
  @Type(() => Number) @IsInt() @IsIn([-3, -2, -1, 1, 2, 3]) stars: number;
  @IsIn([...STAR_REASONS, ...STAR_NEG_REASONS]) reason: string;
  @IsOptional() @IsString() @MaxLength(40) goalId?: string; // mission concernée : le domaine en découle
  @ValidateIf((o) => !o.goalId) @IsIn(STAR_DOMAINS) domain?: string;
  @IsOptional() @IsString() @MaxLength(300) comment?: string;
}
// Les étoiles d'un joueur pour un cours : de 1 à 6 lignes (raison + domaine + nombre d'étoiles), qui remplacent celles du jour
export class StarsDayDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => StarDto) items: StarDto[];
}

// Match déclaré par le jeune : des choix proposés, aucun nom d'adversaire
export const MATCH_KINDS = ["tournoi", "plateau", "equipes", "amical", "entrainement"];
export const MATCH_OPPONENTS = ["plus-fort", "pareil", "moins-fort"];
export const MATCH_SKILLS = ["service", "coup-droit", "revers", "retour", "volee", "deplacements", "calme", "tactique", "physique", "combativite", "concentration"];
export class DeclaredMatchDto {
  @IsDateString() day: string;
  @IsIn(MATCH_KINDS) kind: string;
  @IsOptional() @IsString() @MaxLength(60) event?: string;
  @IsIn(["Victoire", "Défaite"]) result: string;
  @IsOptional() @IsString() @MaxLength(40) score?: string;
  @IsIn(MATCH_OPPONENTS) opponent: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) feeling: number;
  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsIn(MATCH_SKILLS, { each: true }) wellDone?: string[];
  @IsOptional() @IsIn(MATCH_SKILLS) toImprove?: string;
}
export class MatchCommentDto { @IsString() @MaxLength(300) comment: string; }

// Classements de tennis, du plus bas au plus haut (pour « le classement le plus élevé battu »)
export const RANKINGS = ["NC", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15", "-30"];
export class MatchDto {
  @IsDateString() date: string;
  @Transform(trim) @IsString() @MaxLength(120) tournament: string;
  @IsOptional() @IsString() @MaxLength(60) round?: string;
  @IsIn(["Victoire", "Défaite"]) result: string;
  @IsOptional() @IsString() @MaxLength(40) score?: string;
  @IsOptional() @IsString() @MaxLength(300) remark?: string;
  @IsOptional() @IsIn(RANKINGS) opponentRanking?: string;
}

// Auto-évaluation du jeune : surtout des choix pré-enregistrés (identifiants), un mot libre court.
const PRESET_ID = /^[a-z0-9-]{1,40}$/;
export class SelfEvaluationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) mood?: number;
  @IsOptional() @IsObject() ratings?: Record<string, number>;
  @IsOptional() @IsObject() goals?: Record<string, string>;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @Matches(PRESET_ID, { each: true }) proud?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @Matches(PRESET_ID, { each: true }) improve?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @Matches(PRESET_ID, { each: true }) wish?: string[];
  @IsOptional() @IsString() @MaxLength(300) comment?: string;
}

// Entraîneur de comité : créé par le coach avec les jeunes qu'il pourra voir
export class TrainerDto {
  @Transform(trim) @IsString() @MaxLength(60) firstName: string;
  @Transform(lower) @IsEmail() @MaxLength(200) email: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) playerIds: string[];
}
export class TrainerPlayersDto {
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) playerIds: string[];
}

// Corriger le nombre d'étoiles d'une seule ligne (1 à 3) ; pour retirer la dernière étoile on supprime la ligne
export class StarLineDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(3) stars: number;
}

// Les quatre qualités d'un cours, de 1 à 5 (au moins une)
export class QualitiesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) mindset?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) motivation?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) attendance?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) attitude?: number;
}
