import { LessonStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export const PARTNER_LEVELS = ["Débutant", "Loisir / intermédiaire", "NC", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15", "-30", "Je ne sais pas"];
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Date et heure de début du cours (ex. 2026-10-20 à 18:00)
export class SlotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Date invalide." }) date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Heure invalide." }) time: string;
}

export class CreateLessonDto {
  @IsString() @MaxLength(40) profId: string; // professeur choisi (plus de demande libre adressée au coach)
  @ValidateNested() @Type(() => SlotDto) slot: SlotDto; // créneau choisi dans le planning du professeur (le professeur doit le confirmer)
  @IsOptional() @IsBoolean() weekly?: boolean; // « toute l'année » : le même créneau chaque semaine jusqu'au 30 juin (vacances et jours fériés sautés)
  @IsIn(["individuel", "duo"]) type: string;
  @Transform(trim) @IsString() @MaxLength(60) objective: string;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsIn(DAYS, { each: true }) days?: string[];
  @IsOptional() @IsIn(["Peu importe", "Matin", "Après-midi", "Soirée"]) moment?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) message?: string;
  // Cours à DEUX : le partenaire (obligatoire pour un cours « duo », ignoré sinon)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) partnerFirstName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) partnerLastName?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(4) @Max(99) partnerAge?: number;
  @IsOptional() @IsIn(PARTNER_LEVELS) partnerLevel?: string;
}

export class AnswerLessonDto {
  @IsIn([LessonStatus.REFUSED]) status: LessonStatus; // le professeur (ou le coach) refuse ou annule : le créneau est libéré (plus de « proposer une date »)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) reply?: string;
}

// Annulation par l'adulte : ce cours seulement, ou toute la série à venir
export class CancelLessonDto {
  @IsOptional() @IsBoolean() series?: boolean;
}

// Arrêt d'une série par le professeur ou le coach (un petit mot facultatif pour l'adulte)
export class StopSeriesDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) reply?: string;
}
