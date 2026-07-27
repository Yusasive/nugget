import type { ExpenseCategoryDto } from '@nugget/shared-types';
import type { ExpenseCategory } from '../generated/prisma/client';

export function toExpenseCategoryDto(
  category: ExpenseCategory,
): ExpenseCategoryDto {
  return {
    id: category.id,
    branchId: category.branchId,
    name: category.name,
  };
}
