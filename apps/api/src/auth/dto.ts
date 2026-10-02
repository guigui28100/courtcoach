import { Transform } from "class-transformer";
import { Equals, IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

export class SignupDto {
  @Transform(lower) @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(10, { message: "Le mot de passe doit faire au moins 10 caractères." }) @MaxLength(128) password: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) firstName?: string;
  @IsBoolean() @Equals(true, { message: "Il faut accepter la politique de confidentialité." }) acceptPolicy: boolean;
}

export class LoginDto {
  @Transform(lower) @IsEmail() @MaxLength(254) email: string;
  @IsString() @MaxLength(128) password: string;
}

export class AcceptInvitationDto {
  @IsString() @Length(20, 200) token: string;
  @IsString() @MinLength(10, { message: "Le mot de passe doit faire au moins 10 caractères." }) @MaxLength(128) password: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) firstName?: string;
  @IsBoolean() @Equals(true, { message: "Il faut accepter la politique de confidentialité." }) acceptPolicy: boolean;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword: string;
  @IsString() @MinLength(10, { message: "Le nouveau mot de passe doit faire au moins 10 caractères." }) @MaxLength(128) newPassword: string;
  @IsOptional() @IsBoolean() acceptPolicy?: boolean;
}
