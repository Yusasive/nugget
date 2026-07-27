import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/** Sum of quantity * unitCost across a purchase's line items — computed
 * once at creation and stored on PurchaseRecord.totalCost (unlike the
 * "computed, not stored" order/folio totals elsewhere), since a purchase
 * record is a receipt-shaped snapshot of a completed transaction, not a
 * live view over mutable line items. */
export function computePurchaseTotal(
  lineItems: {
    quantity: Prisma.Decimal | string;
    unitCost: Prisma.Decimal | string;
  }[],
): Prisma.Decimal {
  return lineItems.reduce(
    (sum, line) =>
      sum.add(
        new Prisma.Decimal(line.quantity).mul(
          new Prisma.Decimal(line.unitCost),
        ),
      ),
    new Prisma.Decimal(0),
  );
}

export function assertNonEmptyLineItems(lineItems: unknown[]): void {
  if (lineItems.length === 0) {
    throw new BadRequestException(
      'A purchase record needs at least one line item',
    );
  }
}
