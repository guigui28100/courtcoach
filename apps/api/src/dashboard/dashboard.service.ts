import { ForbiddenException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthUser } from "../common/auth.types";
import { LessonsService } from "../lessons/lessons.service";
import { PlayersService } from "../players/players.service";
import { TournamentReportsService } from "../players/reports.service";
import { ProfsService } from "../profs/profs.service";
import { VideosService } from "../videos/videos.service";

// Tout ce qu'il faut pour l'accueil du coach et du Centre en UNE seule demande (avant : une dizaine, dont une par jeune).
// Chaque morceau garde exactement les droits de sa route d'origine : le coach voit tout, un entraîneur seulement ses jeunes et, s'il donne des cours, ses propres demandes.
@Injectable()
export class DashboardService {
  constructor(private readonly players: PlayersService, private readonly lessons: LessonsService, private readonly reports: TournamentReportsService, private readonly videos: VideosService, private readonly profs: ProfsService) {}

  async get(user: AuthUser) {
    if (user.role !== Role.COACH && user.role !== Role.TRAINER) throw new ForbiddenException("Accès non autorisé");
    const coach = user.role === Role.COACH;
    const [players, lessons, inactive, storage, reports, profs] = await Promise.all([
      this.players.list(user),
      this.lessons.list(user).catch(() => []), // un entraîneur qui ne donne pas de cours n'a aucun accès aux demandes
      coach ? this.players.inactive(user) : Promise.resolve([]),
      coach ? this.videos.storage() : Promise.resolve(null),
      coach ? this.reports.pending(user) : Promise.resolve([]),
      coach ? this.profs.adminList() : Promise.resolve([]),
    ]);
    const selfEvals = await this.players.unreadSelfEvaluations(user, players);
    return { players, lessons, inactive, storage, reports, selfEvals, profsWaiting: profs.filter((p) => p.status === "waiting").length };
  }
}
