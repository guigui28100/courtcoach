import { LessonStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export class CreateLessonDto {
  @IsIn(["individuel", "duo"]) type: string;
  @Transform(trim) @IsString() @MaxLength(60) objective: string;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsIn(DAYS, { each: true }) days?: string[];
  @IsOptional() @IsIn(["Peu importe", "Matin", "Après-midi", "Soirée"]) moment?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) message?: string;
}

// Date et heure de début du cours (ex. 2026-10-20 à 18:00)
export class SlotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Date invalide." }) date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Heure invalide." }) time: string;
}

export class AnswerLessonDto {
  @IsIn([LessonStatus.ACCEPTED, LessonStatus.REFUSED]) status: LessonStatus;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) reply?: string;
  @IsOptional() @ValidateNested() @Type(() => SlotDto) slot?: SlotDto; // obligatoire pour accepter
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) place?: string;
}
