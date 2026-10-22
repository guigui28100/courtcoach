import { Transform } from "class-transformer";
import { IsEmail, IsIn, MaxLength } from "class-validator";
import { Role } from "@prisma/client";

const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

// Le coach invite le président du club ou un membre du bureau
export class ClubInvitationDto {
  @Transform(lower) @IsEmail() @MaxLength(254) email: string;
  @IsIn([Role.PRESIDENT, Role.BUREAU]) role: Role;
}
