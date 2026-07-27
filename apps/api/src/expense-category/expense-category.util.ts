import type { Prisma } from '../generated/prisma/client';

/** PurchaseRecordService always files a purchase under this category
 * (TRD §4/PRD §5.11's "restaurant_purchases"). Find-or-create rather than a
 * seeded row, the same reasoning as tour.util.ts's resolveGuestId — no
 * dedicated seed data exists for any domain module in this codebase, only
 * roles/branch/admin (see prisma/seed.ts). */
export const RESTAURANT_PURCHASES_CATEGORY_NAME = 'Restaurant Purchases';

export async function findOrCreateRestaurantPurchasesCategory(
  tx: Prisma.TransactionClient,
  branchId: string,
): Promise<string> {
  const existing = await tx.expenseCategory.findFirst({
    where: { branchId, name: RESTAURANT_PURCHASES_CATEGORY_NAME },
  });
  if (existing) {
    return existing.id;
  }
  const created = await tx.expenseCategory.create({
    data: { branchId, name: RESTAURANT_PURCHASES_CATEGORY_NAME },
  });
  return created.id;
}
