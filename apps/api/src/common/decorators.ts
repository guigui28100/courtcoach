import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthUser } from "./auth.types";

export const Public = () => SetMetadata("isPublic", true);
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

// Routes autorisées même quand la personne doit encore changer son mot de passe provisoire.
export const AllowMustChange = () => SetMetadata("allowMustChange", true);
