import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { JwtAuthGuard, OriginGuard, RolesGuard } from "./common/guards";
import { LessonsModule } from "./lessons/lessons.module";
import { PlayersModule } from "./players/players.module";
import { VideosModule } from "./videos/videos.module";
import { TournamentsModule } from "./tournaments/tournaments.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { SetupController } from "./setup/setup.controller";

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => process.env.NODE_ENV === "test" && !process.env.TEST_THROTTLE }), // 120 requêtes par minute et par adresse
    PrismaModule, CommonModule, AuthModule, PlayersModule, LessonsModule, VideosModule, TournamentsModule,
  ],
  controllers: [SetupController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
