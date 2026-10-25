import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";
import { MAX_FACTS, MAX_LOGO, MAX_PACKS, PERKS, STATUSES } from "./sponsors.constants";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const DATE_OR_EMPTY = /^(\d{4}-\d{2}-\d{2})?$/;

export class SponsorDto {
  @Transform(trim) @IsString() @MaxLength(80) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) contactName?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(/^[0-9 +().-]{0,20}$/, { message: "Téléphone invalide." }) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) amount?: string;
  @IsOptional() @Matches(DATE_OR_EMPTY, { message: "Date de début invalide." }) startDate?: string;
  @IsOptional() @Matches(DATE_OR_EMPTY, { message: "Date de fin invalide." }) endDate?: string;
  @IsOptional() @IsIn([...STATUSES]) status?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(PERKS.length) @IsIn([...PERKS], { each: true }) perks?: string[];
  @IsOptional() @IsBoolean() onPosters?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_LOGO) logo?: string; // « » = retirer le logo ; absent = garder
  @IsOptional() @Transform(trim) @IsString() @MaxLength(400) note?: string;
}

export class PackDto {
  @Transform(trim) @IsString() @MaxLength(40) name!: string;
  @Transform(trim) @IsString() @MaxLength(40) price!: string; // ex. « 300 € par an », vide = « à définir »
  @IsArray() @ArrayMaxSize(PERKS.length) @IsIn([...PERKS], { each: true }) perks!: string[];
}

// Ce que le club propose aux partenaires : sert au dossier de présentation
export class OfferDto {
  @Transform(trim) @IsString() @MaxLength(600) intro!: string;
  @IsArray() @ArrayMaxSize(MAX_FACTS) @IsString({ each: true }) @MaxLength(80, { each: true }) facts!: string[]; // chiffres et atouts du club
  @IsArray() @ArrayMaxSize(MAX_PACKS) @ValidateNested({ each: true }) @Type(() => PackDto) packs!: PackDto[];
}
