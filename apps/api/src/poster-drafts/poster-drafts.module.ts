import { Module } from "@nestjs/common";
import { PosterDraftsController } from "./poster-drafts.controller";
import { PosterDraftsService } from "./poster-drafts.service";

@Module({ controllers: [PosterDraftsController], providers: [PosterDraftsService] })
export class PosterDraftsModule {}
