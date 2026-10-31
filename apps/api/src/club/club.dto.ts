import { Transform } from "class-transformer";
import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { BANDS, KINDS, MAX_PEOPLE, PEOPLE_ROLES } from "./club.constants";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class FormulaDto {
  @Transform(trim) @IsString() @MaxLength(40) label!: string; // ex. « Adhérent », « Semaine complète »
  @Transform(trim) @IsString() @MaxLength(30) price!: string; // ex. « 60 € » (non adhérent, ou prix unique)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) priceMember?: string; // prix adhérent (facultatif)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) group?: string; // rubrique, ex. « Mini tennis · 3 à 5 ans »
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) detail?: string; // précision, ex. « 5 matinées de 9 h à 12 h »
}

export class ClubEventDto {
  @IsIn([...KINDS]) kind!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) title?: string;
  @Matches(DATE, { message: "Date de début invalide." }) startDate!: string;
  @Matches(DATE, { message: "Date de fin invalide." }) endDate!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn([...BANDS], { each: true }) bands?: string[]; // vide = toute la journée
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsInt({ each: true }) @Min(1, { each: true }) @Max(4, { each: true }) courts?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(24) @Matches(/^[a-z0-9-]{3,24}#\d$/, { each: true, message: "Équipe invalide." }) teams?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) who?: string[];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) note?: string; // description libre (affichée sur l'affiche)
  @IsOptional() @IsBoolean() featured?: boolean; // à mettre en avant sur l'affiche du mois
  @IsOptional() @IsBoolean() tentative?: boolean; // prévisionnel : pas encore validé
  @IsOptional() @Transform(trim) @IsString() @MaxLength(600) time?: string; // horaires (affiche)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) place?: string; // lieu (affiche)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) signup?: string; // inscriptions (affiche)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) audience?: string; // pour qui (affiche)
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) bring?: string; // à prévoir (affiche)
  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => FormulaDto) formulas?: FormulaDto[]; // formules et prix (affiche)
  @IsOptional() @IsBoolean() allowConflict?: boolean; // le coach confirme qu'il veut quand même placer l'événement
}

export class TeamCountsDto {
  @IsObject() counts!: Record<string, number>;
}

export class PersonDto {
  @Transform(trim) @IsString() @MaxLength(60) name!: string;
  @IsIn([...PEOPLE_ROLES]) role!: string;
}
export class PeopleDto {
  @IsArray() @ArrayMaxSize(MAX_PEOPLE) @ValidateNested({ each: true }) @Type(() => PersonDto) people!: PersonDto[];
}

export class ScheduleItemDto {
  @IsInt() @Min(0) @Max(6) weekday!: number; // 0 = lundi … 6 = dimanche
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) label?: string;
  @IsOptional() @IsIn(["ADULTES", "COMPETITION", "ECOLE"]) kind?: string; // cours adultes, compétition jeunes, école de tennis
}
export class ScheduleDto {
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ScheduleItemDto) items!: ScheduleItemDto[];
}

// Nouvel ordre des événements d'une case du calendrier
export class ReorderDto {
  @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) @MaxLength(60, { each: true }) ids!: string[];
}
