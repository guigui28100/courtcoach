import { Module } from "@nestjs/common";
import { LessonsController } from "./lessons.controller";
import { LessonsService } from "./lessons.service";
import { ProfsModule } from "../profs/profs.module";

@Module({ imports: [ProfsModule], controllers: [LessonsController], providers: [LessonsService], exports: [LessonsService] })
export class LessonsModule {}
