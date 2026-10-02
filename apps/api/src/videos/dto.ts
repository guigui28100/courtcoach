import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export const SHOTS = ["Coup droit", "Revers", "Service", "Retour de service", "Volée", "Smash", "Jeu de jambes", "Autre"];
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // 80 Mo par vidéo

export class CreateVideoDto {
  @Transform(trim) @IsString() @MaxLength(80) title: string;
  @IsIn(SHOTS) shot: string;
  @IsOptional() @IsString() @MaxLength(500) question?: string;
  @Type(() => Number) @IsInt() @Min(1024) @Max(MAX_VIDEO_BYTES) sizeBytes: number;
  @IsOptional() @IsString() @MaxLength(40) playerId?: string;
}

export class AnalysisDto {
  @IsOptional() @IsString() @MaxLength(3000) observation?: string;
  @IsOptional() @IsString() @MaxLength(2000) strengths?: string;
  @IsOptional() @IsString() @MaxLength(2000) improve?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(300, { each: true }) exercises?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) goalIds?: string[];
}

export class MessageDto {
  @Transform(trim) @IsString() @MaxLength(1000) text: string;
}
