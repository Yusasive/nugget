import { Injectable } from '@nestjs/common';

interface RecordAuditEntryInput {
  staffId: string | null;
  branchId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

interface AuditCapableClient {
  auditLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

@Injectable()
export class AuditService {
  /**
   * Takes the caller's own Prisma client/transaction handle rather than
   * injecting one — so the audit row is written inside the *same*
   * transaction as the mutation it's recording (TRD §4: "every mutating
   * endpoint writes an audit log entry as part of the same transaction"),
   * and a failure on either side rolls back both.
   */
  async record(
    tx: AuditCapableClient,
    entry: RecordAuditEntryInput,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        staffId: entry.staffId,
        branchId: entry.branchId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  }
}
