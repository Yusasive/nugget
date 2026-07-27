import type { PaginationQuery } from "./pagination";

/** PRD §5.14/§5.15's staff activity/audit log viewer — a read-only window
 * over the AuditLog table every mutating endpoint has been writing to
 * since Milestone 1 (TRD §4). */
export interface AuditLogEntryDto {
  id: string;
  branchId: string | null;
  staff: { id: string; firstName: string; lastName: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListAuditLogQuery extends PaginationQuery {
  staffId?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  /** Only takes effect for Super Admin — every other role is force-scoped to their own branch server-side. */
  branchId?: string;
}
