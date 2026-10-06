import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { TrainerDto, TrainerPlayersDto } from "./dto";
import { TrainersService } from "./trainers.service";

// Gestion des entraîneurs de comité : réservée au coach.
@Roles(Role.COACH)
@Controller()
export class TrainersController {
  constructor(private readonly svc: TrainersService) {}

  @Get("trainers") list() { return this.svc.list(); }
  @Post("trainers") create(@CurrentUser() u: AuthUser, @Body() dto: TrainerDto) { return this.svc.create(u, dto); }
  @Put("trainers/:id/players") setPlayers(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() dto: TrainerPlayersDto) { return this.svc.setPlayers(u, id, dto.playerIds); }
  @Post("trainers/:id/reset-password") @HttpCode(200) resetPassword(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.resetPassword(u, id); }
  @Delete("trainers/:id") @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
}
