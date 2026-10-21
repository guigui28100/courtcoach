import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { clashesWith, CLAY_COURTS, MAX_TEAMS, PlanEvent, TEAM_CATS } from "./club.constants";
import { PersonDto } from "./club.dto";
import { ClubEventDto } from "./club.dto";

const validDate = (d: string) => { const x = new Date(`${d}T00:00:00Z`); return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d; };
const uniq = <T,>(a: T[] | undefined) => [...new Set(a ?? [])];

// Planning prévisionnel du club : réservé au coach. Un événement = un type, des jours, des moments, des courts, des équipes et des responsables. Aucune donnée d'enfant.
@Injectable()
export class ClubService {
  constructor(private readonly prisma: PrismaService) {}

  private async counts(): Promise<Record<string, number>> {
    const row = await this.prisma.clubSetting.findUnique({ where: { key: "teamCounts" } });
    const saved = (row?.value ?? {}) as Record<string, number>;
    return Object.fromEntries(TEAM_CATS.map(([k, n]) => [k, Number.isInteger(saved[k]) ? saved[k] : n]));
  }

  // Bénévoles, membres du bureau et autres personnes à affecter (noms saisis une seule fois par le coach)
  private async people(): Promise<{ name: string; role: string }[]> {
    const row = await this.prisma.clubSetting.findUnique({ where: { key: "people" } });
    return Array.isArray(row?.value) ? (row!.value as { name: string; role: string }[]) : [];
  }

  async setPeople(list: PersonDto[]) {
    const seen = new Set<string>(); const out: { name: string; role: string }[] = [];
    for (const p of list) {
      const name = p.name.trim().replace(/\s+/g, " ");
      if (!name) throw new BadRequestException("Un nom est vide.");
      if (seen.has(name.toLowerCase())) throw new BadRequestException(`« ${name} » est écrit deux fois.`);
      seen.add(name.toLowerCase()); out.push({ name, role: p.role });
    }
    await this.prisma.clubSetting.upsert({ where: { key: "people" }, update: { value: out }, create: { key: "people", value: out } });
    return out;
  }

  async plan() {
    const events = await this.prisma.clubEvent.findMany({ orderBy: [{ startDate: "asc" }, { createdAt: "asc" }] });
    return { events, teamCounts: await this.counts(), people: await this.people() };
  }

  async setTeams(counts: Record<string, number>) {
    const keys = TEAM_CATS.map(([k]) => k);
    const merged = await this.counts();
    for (const [k, v] of Object.entries(counts)) {
      if (!keys.includes(k)) throw new BadRequestException("Catégorie d'équipes inconnue.");
      if (!Number.isInteger(v) || v < 0 || v > MAX_TEAMS) throw new BadRequestException(`Le nombre d'équipes doit être entre 0 et ${MAX_TEAMS}.`);
      merged[k] = v;
    }
    await this.prisma.clubSetting.upsert({ where: { key: "teamCounts" }, update: { value: merged }, create: { key: "teamCounts", value: merged } });
    return merged;
  }

  private async clean(dto: ClubEventDto): Promise<PlanEvent> {
    if (!validDate(dto.startDate) || !validDate(dto.endDate)) throw new BadRequestException("Date invalide.");
    if (dto.endDate < dto.startDate) throw new BadRequestException("Le dernier jour doit être après le premier.");
    const courts = uniq(dto.courts).sort();
    const teams = uniq(dto.teams);
    const counts = await this.counts();
    for (const t of teams) { const [cat, n] = t.split("#"); if (!(cat in counts) || Number(n) < 1 || Number(n) > counts[cat]) throw new BadRequestException("Cette équipe n'existe pas dans « Mes équipes »."); }
    if (dto.kind === "EQUIPES" && teams.length === 0) throw new BadRequestException("Choisis au moins une équipe.");
    if (dto.kind !== "EQUIPES" && teams.length) throw new BadRequestException("Les équipes ne servent que pour un match par équipes.");
    if (dto.kind === "TERRE_BATTUE" && courts.some((c) => !CLAY_COURTS.includes(c))) throw new BadRequestException("La réfection concerne les courts en terre battue (1 et 2).");
    return { kind: dto.kind, startDate: dto.startDate, endDate: dto.endDate, bands: uniq(dto.bands), courts, teams, title: (dto.title ?? "").trim() };
  }

  private async check(ev: PlanEvent, dto: ClubEventDto, exceptId?: string) {
    const others = (await this.prisma.clubEvent.findMany({ where: { startDate: { lte: ev.endDate }, endDate: { gte: ev.startDate } } })).filter((o) => o.id !== exceptId);
    const clashes = clashesWith(ev, others);
    if (clashes.length && !dto.allowConflict) throw new ConflictException({ message: `Conflit : ${clashes[0].why}.`, clashes });
  }

  async create(dto: ClubEventDto) {
    const ev = await this.clean(dto); await this.check(ev, dto);
    return this.prisma.clubEvent.create({ data: { ...ev, title: ev.title ?? "", who: uniq(dto.who).map((s) => s.trim()).filter(Boolean), note: dto.note ?? "", featured: dto.featured === true } });
  }

  async update(id: string, dto: ClubEventDto) {
    if (!(await this.prisma.clubEvent.findUnique({ where: { id } }))) throw new NotFoundException("Événement introuvable");
    const ev = await this.clean(dto); await this.check(ev, dto, id);
    return this.prisma.clubEvent.update({ where: { id }, data: { ...ev, title: ev.title ?? "", who: uniq(dto.who).map((s) => s.trim()).filter(Boolean), note: dto.note ?? "", featured: dto.featured === true } });
  }

  async remove(id: string) {
    const r = await this.prisma.clubEvent.deleteMany({ where: { id } });
    if (!r.count) throw new NotFoundException("Événement introuvable");
    return { deleted: true };
  }
}
