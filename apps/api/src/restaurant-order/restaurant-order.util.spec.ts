import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  assertForwardKitchenTransition,
  computeOrderTotal,
} from './restaurant-order.util';

describe('computeOrderTotal', () => {
  it('sums quantity * unitPriceAtOrder across items', () => {
    const total = computeOrderTotal([
      { quantity: 2, unitPriceAtOrder: new Prisma.Decimal('1500.00') },
      { quantity: 1, unitPriceAtOrder: new Prisma.Decimal('750.50') },
    ]);
    expect(total.toString()).toBe('3750.5');
  });

  it('returns zero for no items', () => {
    expect(computeOrderTotal([]).toString()).toBe('0');
  });
});

describe('assertForwardKitchenTransition', () => {
  it('allows the next step in the pipeline', () => {
    expect(() =>
      assertForwardKitchenTransition('PENDING', 'PREPARING'),
    ).not.toThrow();
    expect(() =>
      assertForwardKitchenTransition('PREPARING', 'READY'),
    ).not.toThrow();
    expect(() =>
      assertForwardKitchenTransition('READY', 'SERVED'),
    ).not.toThrow();
  });

  it('rejects skipping a step', () => {
    expect(() => assertForwardKitchenTransition('PENDING', 'READY')).toThrow(
      ConflictException,
    );
  });

  it('rejects moving backward', () => {
    expect(() =>
      assertForwardKitchenTransition('PREPARING', 'PENDING'),
    ).toThrow(ConflictException);
  });

  it('rejects a no-op transition', () => {
    expect(() => assertForwardKitchenTransition('PENDING', 'PENDING')).toThrow(
      ConflictException,
    );
  });
});
