import { Module } from "@nestjs/common";
import { LessonsModule } from "../lessons/lessons.module";
import { PlayersModule } from "../players/players.module";
import { ProfsModule } from "../profs/profs.module";
import { VideosModule } from "../videos/videos.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({ imports: [PlayersModule, LessonsModule, VideosModule, ProfsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
