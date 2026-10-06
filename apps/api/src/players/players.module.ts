import { Module } from "@nestjs/common";
import { PlayersController } from "./players.controller";
import { PlayersService } from "./players.service";
import { TrainersController } from "./trainers.controller";
import { TrainersService } from "./trainers.service";

@Module({ controllers: [PlayersController, TrainersController], providers: [PlayersService, TrainersService] })
export class PlayersModule {}
