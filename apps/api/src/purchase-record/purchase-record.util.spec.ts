import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  assertNonEmptyLineItems,
  computePurchaseTotal,
} from './purchase-record.util';

describe('computePurchaseTotal', () => {
  it('sums quantity * unitCost across line items', () => {
    const total = computePurchaseTotal([
      { quantity: '10', unitCost: '5.50' },
      {
        quantity: new Prisma.Decimal('2'),
        unitCost: new Prisma.Decimal('100.00'),
      },
    ]);
    expect(total.toString()).toBe('255');
  });

  it('returns zero for no line items', () => {
    expect(computePurchaseTotal([]).toString()).toBe('0');
  });
});

describe('assertNonEmptyLineItems', () => {
  it('rejects an empty array', () => {
    expect(() => assertNonEmptyLineItems([])).toThrow(BadRequestException);
  });

  it('accepts a non-empty array', () => {
    expect(() => assertNonEmptyLineItems([{}])).not.toThrow();
  });
});
