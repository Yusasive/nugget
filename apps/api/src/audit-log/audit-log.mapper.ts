import type { AuditLogEntryDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const AUDIT_LOG_INCLUDE = {
  staff: true,
} as const;

export type AuditLogWithRelations = Prisma.AuditLogGetPayload<{
  include: typeof AUDIT_LOG_INCLUDE;
}>;

export function toAuditLogEntryDto(
  entry: AuditLogWithRelations,
): AuditLogEntryDto {
  return {
    id: entry.id,
    branchId: entry.branchId,
    staff: entry.staff
      ? {
          id: entry.staff.id,
          firstName: entry.staff.firstName,
          lastName: entry.staff.lastName,
        }
      : null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}
