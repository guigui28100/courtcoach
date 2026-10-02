import { LessonStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export class CreateLessonDto {
  @IsIn(["individuel", "duo", "video"]) type: string;
  @Transform(trim) @IsString() @MaxLength(60) objective: string;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsIn(DAYS, { each: true }) days?: string[];
  @IsOptional() @IsIn(["Peu importe", "Matin", "Après-midi", "Soirée"]) moment?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) message?: string;
}

export class AnswerLessonDto {
  @IsIn([LessonStatus.ACCEPTED, LessonStatus.REFUSED]) status: LessonStatus;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) reply?: string;
}
