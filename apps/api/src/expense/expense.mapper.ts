import type { ExpenseDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const EXPENSE_INCLUDE = {
  category: true,
} as const;

export type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof EXPENSE_INCLUDE;
}>;

export function toExpenseDto(expense: ExpenseWithRelations): ExpenseDto {
  return {
    id: expense.id,
    branchId: expense.branchId,
    category: {
      id: expense.category.id,
      branchId: expense.category.branchId,
      name: expense.category.name,
    },
    purchaseRecordId: expense.purchaseRecordId,
    amount: expense.amount.toString(),
    description: expense.description,
    incurredAt: expense.incurredAt.toISOString(),
    status: expense.status,
    createdByStaffId: expense.createdByStaffId,
    approvedByStaffId: expense.approvedByStaffId,
    createdAt: expense.createdAt.toISOString(),
  };
}
