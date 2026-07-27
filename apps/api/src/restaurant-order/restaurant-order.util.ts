import { ConflictException } from '@nestjs/common';
import type { KitchenItemStatus } from '@nugget/shared-types';
import { Prisma } from '../generated/prisma/client';

/** Sum of quantity * unitPriceAtOrder across an order's line items — the
 * order's total is never stored, computed at read/bill time the same as
 * every other "computed, not stored" value in this codebase. */
export function computeOrderTotal(
  items: { quantity: number; unitPriceAtOrder: Prisma.Decimal }[],
): Prisma.Decimal {
  return items.reduce(
    (sum, item) => sum.add(item.unitPriceAtOrder.mul(item.quantity)),
    new Prisma.Decimal(0),
  );
}

const KITCHEN_STATUS_ORDER: KitchenItemStatus[] = [
  'PENDING',
  'PREPARING',
  'READY',
  'SERVED',
];

/** The KOT pipeline only moves forward one step at a time (TRD §3.3) — a
 * kitchen can't skip PREPARING or walk an item back to PENDING. */
export function assertForwardKitchenTransition(
  current: KitchenItemStatus,
  next: KitchenItemStatus,
): void {
  const currentIndex = KITCHEN_STATUS_ORDER.indexOf(current);
  const nextIndex = KITCHEN_STATUS_ORDER.indexOf(next);
  if (nextIndex !== currentIndex + 1) {
    throw new ConflictException(
      `Cannot move an order item from ${current} to ${next}`,
    );
  }
}
