import { LessonStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export const PARTNER_LEVELS = ["Débutant", "Loisir / intermédiaire", "NC", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15", "-30", "Je ne sais pas"];
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Date et heure de début du cours (ex. 2026-10-20 à 18:00)
export class SlotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Date invalide." }) date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Heure invalide." }) time: string;
}

export class CreateLessonDto {
  @IsOptional() @IsString() @MaxLength(40) profId?: string; // professeur choisi (vide = demande adressée au coach)
  @IsOptional() @ValidateNested() @Type(() => SlotDto) slot?: SlotDto; // créneau réservé dans le planning du professeur (le cours est alors confirmé tout de suite)
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
  @IsIn([LessonStatus.PROPOSED, LessonStatus.REFUSED]) status: LessonStatus; // PROPOSED : le coach propose une date, l'adulte doit la confirmer
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) reply?: string;
  @IsOptional() @ValidateNested() @Type(() => SlotDto) slot?: SlotDto; // obligatoire pour proposer
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) place?: string;
}

// Réponse de l'adulte à la date proposée : il la confirme, ou dit qu'il n'est pas disponible
export class RespondLessonDto {
  @IsIn(["confirm", "decline"]) action: "confirm" | "decline";
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) message?: string;
}
