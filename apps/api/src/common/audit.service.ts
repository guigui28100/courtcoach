import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Journal des actions sensibles : qui a fait quoi, sur quoi, quand (jamais le contenu).
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  log(userId: string | null, action: string, entity: string, entityId?: string) {
    return this.prisma.auditLog.create({ data: { userId, action, entity, entityId } }).catch(() => undefined);
  }
}
