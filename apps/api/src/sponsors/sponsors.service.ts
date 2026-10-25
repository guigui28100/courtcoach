import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MAX_SPONSORS } from "./sponsors.constants";
import { OfferDto, SponsorDto } from "./sponsors.dto";

const validDate = (d: string) => d === "" || (() => { const x = new Date(`${d}T00:00:00Z`); return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d; })();
const PNG = [0x89, 0x50, 0x4e, 0x47], JPG = [0xff, 0xd8, 0xff];

// Le logo est une vraie image PNG ou JPEG (on vérifie les premiers octets, jamais le nom ni le type annoncé)
function checkLogo(logo: string) {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(logo);
  if (!m) throw new BadRequestException("Le logo doit être une image PNG ou JPEG.");
  const head = Buffer.from(m[2].slice(0, 16), "base64");
  const want = m[1] === "png" ? PNG : JPG;
  if (!want.every((b, i) => head[i] === b)) throw new BadRequestException("Ce fichier n'est pas une vraie image PNG ou JPEG.");
}

export const DEFAULT_OFFER = {
  intro: "Le Tennis Club Houdan réunit des joueurs de tous âges autour de 4 courts couverts. Devenir partenaire, c'est soutenir le sport local et faire connaître votre entreprise auprès des familles du club.",
  facts: ["4 courts couverts, terre battue et dur", "Des stages, des tournois et des animations toute l'année"],
  packs: [
    { name: "Partenaire", price: "", perks: ["AFFICHE_MOIS"] },
    { name: "Partenaire argent", price: "", perks: ["AFFICHE_MOIS", "AFFICHE_EVENT", "STAGES"] },
    { name: "Partenaire or", price: "", perks: ["AFFICHE_MOIS", "AFFICHE_EVENT", "STAGES", "BACHE", "TOURNOI", "SITE"] },
  ],
};

// Partenaires du club (entreprises) : coach et président seulement. Aucune donnée d'élève.
@Injectable()
export class SponsorsService {
  constructor(private readonly prisma: PrismaService) {}

  private async offer(): Promise<OfferDto> {
    const row = await this.prisma.clubSetting.findUnique({ where: { key: "sponsorOffer" } });
    return (row?.value as unknown as OfferDto) ?? DEFAULT_OFFER;
  }

  async list() {
    return { sponsors: await this.prisma.sponsor.findMany({ orderBy: [{ name: "asc" }] }), offer: await this.offer() };
  }

  private data(dto: SponsorDto) {
    if (!dto.name.trim()) throw new BadRequestException("Écris le nom du partenaire.");
    if (!validDate(dto.startDate ?? "") || !validDate(dto.endDate ?? "")) throw new BadRequestException("Date invalide.");
    if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException("La fin du contrat doit être après le début.");
    if (dto.logo) checkLogo(dto.logo);
    const d: Record<string, unknown> = {
      name: dto.name.trim(), contactName: dto.contactName ?? "", phone: dto.phone ?? "", email: dto.email ?? "", amount: dto.amount ?? "",
      startDate: dto.startDate ?? "", endDate: dto.endDate ?? "", status: dto.status ?? "A_CONTACTER", perks: [...new Set(dto.perks ?? [])],
      onPosters: dto.onPosters === true, note: dto.note ?? "",
    };
    if (dto.logo !== undefined) d.logo = dto.logo;
    return d;
  }

  async create(dto: SponsorDto) {
    if ((await this.prisma.sponsor.count()) >= MAX_SPONSORS) throw new BadRequestException(`Tu as déjà ${MAX_SPONSORS} partenaires : supprime-en avant d'en ajouter.`);
    const data = this.data(dto);
    if (data.onPosters && !dto.logo) throw new BadRequestException("Pour mettre un partenaire sur les affiches, ajoute d'abord son logo.");
    return this.prisma.sponsor.create({ data: data as never });
  }

  async update(id: string, dto: SponsorDto) {
    const old = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!old) throw new NotFoundException("Partenaire introuvable");
    const data = this.data(dto);
    const logo = dto.logo !== undefined ? dto.logo : old.logo;
    if (data.onPosters && !logo) throw new BadRequestException("Pour mettre un partenaire sur les affiches, ajoute d'abord son logo.");
    return this.prisma.sponsor.update({ where: { id }, data: data as never });
  }

  async remove(id: string) {
    const r = await this.prisma.sponsor.deleteMany({ where: { id } });
    if (!r.count) throw new NotFoundException("Partenaire introuvable");
    return { deleted: true };
  }

  async setOffer(dto: OfferDto) {
    const value = {
      intro: dto.intro, facts: dto.facts.map((f) => f.trim()).filter(Boolean),
      packs: dto.packs.map((p) => ({ name: p.name.trim(), price: p.price.trim(), perks: [...new Set(p.perks)] })).filter((p) => p.name),
    };
    await this.prisma.clubSetting.upsert({ where: { key: "sponsorOffer" }, update: { value }, create: { key: "sponsorOffer", value } });
    return value;
  }
}
