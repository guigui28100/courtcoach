import { Axis, ConsentKind, Role } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

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
}

export class UpdateGoalDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) indicator?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress?: number;
}

export class EvaluationDto {
  @IsOptional() @IsObject() ratings?: Record<string, number>;
  @IsOptional() @IsObject() comments?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(3000) strengths?: string;
  @IsOptional() @IsString() @MaxLength(3000) improve?: string;
  @IsOptional() @IsString() @MaxLength(3000) next?: string;
  @IsOptional() @IsString() @MaxLength(3000) appreciation?: string;
}

export class MatchDto {
  @IsDateString() date: string;
  @Transform(trim) @IsString() @MaxLength(120) tournament: string;
  @IsOptional() @IsString() @MaxLength(60) round?: string;
  @IsIn(["Victoire", "Défaite"]) result: string;
  @IsOptional() @IsString() @MaxLength(40) score?: string;
  @IsOptional() @IsString() @MaxLength(300) remark?: string;
}
