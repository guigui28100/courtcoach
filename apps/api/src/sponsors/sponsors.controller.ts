import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators";
import { OfferDto, SponsorDto } from "./sponsors.dto";
import { SponsorsService } from "./sponsors.service";

// Partenaires du club : le coach, le président et le bureau (accès complet) ; les entraîneurs, les adultes et les familles : 403)
@Roles(Role.COACH, Role.PRESIDENT, Role.BUREAU)
@Controller("sponsors")
export class SponsorsController {
  constructor(private readonly svc: SponsorsService) {}
  @Get() list() { return this.svc.list(); }
  @Put("offer") @HttpCode(200) offer(@Body() dto: OfferDto) { return this.svc.setOffer(dto); }
  @Post() create(@Body() dto: SponsorDto) { return this.svc.create(dto); }
  @Put(":id") @HttpCode(200) update(@Param("id") id: string, @Body() dto: SponsorDto) { return this.svc.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.svc.remove(id); }
}
