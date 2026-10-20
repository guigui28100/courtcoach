import { BadRequestException } from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const HOUR = /^([01]\d|2[0-3]):[0-5]\d$/;
const RANK = /^[A-Za-z0-9/\- ]{1,12}$/;
export const DOC_KINDS = ["CARTE_PRO", "DIPLOME", "AUTO_ENTREPRENEUR"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export class ProfProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) firstName?: string; // seulement pris en compte pour le coach
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsInt() @Min(1930) @Max(2012) birthYear?: number;
  @IsOptional() @IsBoolean() showAge?: boolean;
  @IsOptional() @Transform(trim) @Matches(RANK, { message: "Classement invalide." }) ranking?: string;
  @IsOptional() @Transform(trim) @Matches(RANK, { message: "Classement invalide." }) bestRanking?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) bio?: string;
  @IsOptional() @IsBoolean() paused?: boolean;
  @IsOptional() @IsBoolean() skipHolidays?: boolean; // « je ne donne pas de cours pendant les vacances scolaires et les jours fériés »
}

export class SlotDto {
  @IsOptional() @IsInt() @Min(0) @Max(6) weekday?: number; // 0 = lundi … 6 = dimanche
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Date invalide." }) date?: string;
  @Matches(HOUR, { message: "Heure invalide." }) start: string;
  @Matches(HOUR, { message: "Heure invalide." }) end: string;
}
export class SlotsDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => SlotDto) slots: SlotDto[];
}

export class ApproveDto {
  @IsBoolean() approved: boolean;
}
export const kindOf = (k: string): DocKind => {
  if (!(DOC_KINDS as readonly string[]).includes(k)) throw new BadRequestException("Type de document inconnu.");
  return k as DocKind;
};
