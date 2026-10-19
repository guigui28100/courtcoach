import { Module } from "@nestjs/common";
import { ProfsController } from "./profs.controller";
import { ProfsService } from "./profs.service";

@Module({ controllers: [ProfsController], providers: [ProfsService], exports: [ProfsService] })
export class ProfsModule {}
