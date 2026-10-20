import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { BANDS, KINDS } from "./club.constants";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ClubEventDto {
  @IsIn([...KINDS]) kind!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) title?: string;
  @Matches(DATE, { message: "Date de début invalide." }) startDate!: string;
  @Matches(DATE, { message: "Date de fin invalide." }) endDate!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn([...BANDS], { each: true }) bands?: string[]; // vide = toute la journée
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsInt({ each: true }) @Min(1, { each: true }) @Max(4, { each: true }) courts?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(24) @Matches(/^[a-z0-9-]{3,24}#\d$/, { each: true, message: "Équipe invalide." }) teams?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true }) who?: string[];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsBoolean() allowConflict?: boolean; // le coach confirme qu'il veut quand même placer l'événement
}

export class TeamCountsDto {
  @IsObject() counts!: Record<string, number>;
}
