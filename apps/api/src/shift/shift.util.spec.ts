import { Prisma } from '../generated/prisma/client';
import { computeCashReconciliation } from './shift.util';

function d(value: string) {
  return new Prisma.Decimal(value);
}

describe('computeCashReconciliation', () => {
  it('computes zero discrepancy when the drawer matches exactly', () => {
    const result = computeCashReconciliation(
      d('5000'),
      [
        { type: 'CASH_IN', amount: d('1500') },
        { type: 'CASH_IN', amount: d('2000') },
      ],
      d('8500'),
    );
    expect(result.totalCashCollected.toString()).toBe('3500');
    expect(result.closingCashExpected.toString()).toBe('8500');
    expect(result.discrepancy.toString()).toBe('0');
  });

  it('nets CASH_OUT transactions against CASH_IN', () => {
    const result = computeCashReconciliation(
      d('5000'),
      [
        { type: 'CASH_IN', amount: d('2000') },
        { type: 'CASH_OUT', amount: d('500') },
      ],
      d('6500'),
    );
    expect(result.totalCashCollected.toString()).toBe('1500');
    expect(result.closingCashExpected.toString()).toBe('6500');
    expect(result.discrepancy.toString()).toBe('0');
  });

  it('flags a positive discrepancy when there is more cash than expected', () => {
    const result = computeCashReconciliation(
      d('1000'),
      [{ type: 'CASH_IN', amount: d('500') }],
      d('1600'),
    );
    expect(result.closingCashExpected.toString()).toBe('1500');
    expect(result.discrepancy.toString()).toBe('100');
  });

  it('flags a negative discrepancy when cash is short', () => {
    const result = computeCashReconciliation(
      d('1000'),
      [{ type: 'CASH_IN', amount: d('500') }],
      d('1400'),
    );
    expect(result.closingCashExpected.toString()).toBe('1500');
    expect(result.discrepancy.toString()).toBe('-100');
  });

  it('treats totalSales as equal to totalCashCollected (Phase 1: cash-only)', () => {
    const result = computeCashReconciliation(
      d('0'),
      [{ type: 'CASH_IN', amount: d('300') }],
      d('300'),
    );
    expect(result.totalSales.toString()).toBe(
      result.totalCashCollected.toString(),
    );
  });

  it('handles no transactions at all (an uneventful shift)', () => {
    const result = computeCashReconciliation(d('2000'), [], d('2000'));
    expect(result.closingCashExpected.toString()).toBe('2000');
    expect(result.discrepancy.toString()).toBe('0');
  });
});
