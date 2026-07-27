import type { PurchaseLineItem, PurchaseRecordDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const PURCHASE_RECORD_INCLUDE = {
  supplier: true,
} as const;

export type PurchaseRecordWithRelations = Prisma.PurchaseRecordGetPayload<{
  include: typeof PURCHASE_RECORD_INCLUDE;
}> & { expense?: { id: string } | null };

export function toPurchaseRecordDto(
  record: PurchaseRecordWithRelations,
): PurchaseRecordDto {
  return {
    id: record.id,
    branchId: record.branchId,
    supplier: { id: record.supplier.id, name: record.supplier.name },
    lineItems: record.lineItems as unknown as PurchaseLineItem[],
    totalCost: record.totalCost.toString(),
    purchasedAt: record.purchasedAt.toISOString(),
    createdByStaffId: record.createdByStaffId,
    createdAt: record.createdAt.toISOString(),
    expenseId: record.expense?.id ?? null,
  };
}
