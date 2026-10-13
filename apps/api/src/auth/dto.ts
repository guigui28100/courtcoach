import { Transform } from "class-transformer";
import { Equals, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

export class SignupDto {
  @Transform(lower) @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(10, { message: "Le mot de passe doit faire au moins 10 caractères." }) @MaxLength(128) password: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsInt() @Min(1920) @Max(2030) birthYear?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) level?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(/^[0-9 +().-]{6,20}$/, { message: "Numéro de téléphone invalide." }) phone?: string;
  @IsBoolean() @Equals(true, { message: "Il faut accepter la politique de confidentialité." }) acceptPolicy: boolean;
}

// Profil de l'adulte (modifiable ensuite depuis son espace) : tout est facultatif
export class AdultProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsInt() @Min(1920) @Max(2030) birthYear?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) level?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(/^[0-9 +().-]{6,20}$/, { message: "Numéro de téléphone invalide." }) phone?: string;
}

export class LoginDto {
  @Transform(lower) @IsEmail() @MaxLength(254) email: string;
  @IsString() @MaxLength(128) password: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
}

export class AcceptInvitationDto {
  @IsString() @Length(20, 200) token: string;
  @IsString() @MinLength(10, { message: "Le mot de passe doit faire au moins 10 caractères." }) @MaxLength(128) password: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) firstName?: string;
  @IsBoolean() @Equals(true, { message: "Il faut accepter la politique de confidentialité." }) acceptPolicy: boolean;
}

export class ChangePasswordDto {
  @IsOptional() @IsString() @MaxLength(128) currentPassword?: string; // inutile à la première connexion (le mot de passe provisoire vient d'être saisi)
  @IsString() @MinLength(10, { message: "Le nouveau mot de passe doit faire au moins 10 caractères." }) @MaxLength(128) newPassword: string;
  @IsOptional() @IsBoolean() acceptPolicy?: boolean;
}

export class TotpCodeDto { @IsString() @Length(6, 6) code: string; }
export class TotpDisableDto { @IsString() @MaxLength(128) password: string; @IsString() @Length(6, 6) code: string; }
