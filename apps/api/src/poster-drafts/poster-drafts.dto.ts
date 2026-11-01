import { Transform } from "class-transformer";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export const KINDS = ["resultats"] as const;
export const MAX_DATA = 60_000; // le texte de l'affiche (les photos sont envoyées une par une)

export class CreateDraftDto {
  @IsIn([...KINDS]) kind!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() @MaxLength(MAX_DATA) data!: string;
}
export class UpdateDraftDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() @MaxLength(MAX_DATA) data!: string;
}
