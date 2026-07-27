import { Inject, Injectable } from '@nestjs/common';
import type { AuditLogEntryDto, PaginatedResponse } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { AUDIT_LOG_INCLUDE, toAuditLogEntryDto } from './audit-log.mapper';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListAuditLogQueryDto,
  ): Promise<PaginatedResponse<AuditLogEntryDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      // Only takes effect for Super Admin — the branch-scoping extension
      // force-overwrites this for every other role regardless.
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: AUDIT_LOG_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return buildPaginatedResponse(
      entries.map(toAuditLogEntryDto),
      total,
      page,
      pageSize,
    );
  }
}
