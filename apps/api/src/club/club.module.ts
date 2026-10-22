import { Module } from "@nestjs/common";
import { ClubController } from "./club.controller";
import { ClubService } from "./club.service";
import { ClubAccessController } from "./club-access.controller";
import { ClubAccessService } from "./club-access.service";

@Module({ controllers: [ClubController, ClubAccessController], providers: [ClubService, ClubAccessService] })
export class ClubModule {}
