import { Prisma } from '../generated/prisma/client';
import {
  computeFolioTotals,
  computeInvoiceAmountPaid,
  deriveInvoicePaymentStatus,
  formatInvoiceNumber,
  paymentNetAmount,
  type PaymentLike,
} from './billing.util';

function d(value: string) {
  return new Prisma.Decimal(value);
}

describe('paymentNetAmount', () => {
  it('counts a SUCCESSFUL payment with no refunds in full', () => {
    const payment: PaymentLike = {
      amount: d('100'),
      status: 'SUCCESSFUL',
      refunds: [],
    };
    expect(paymentNetAmount(payment).toString()).toBe('100');
  });

  it('contributes zero for a PENDING payment', () => {
    const payment: PaymentLike = {
      amount: d('100'),
      status: 'PENDING',
      refunds: [],
    };
    expect(paymentNetAmount(payment).toString()).toBe('0');
  });

  it('contributes zero for a FAILED payment', () => {
    const payment: PaymentLike = {
      amount: d('100'),
      status: 'FAILED',
      refunds: [],
    };
    expect(paymentNetAmount(payment).toString()).toBe('0');
  });

  it('subtracts a successful refund from a PARTIALLY_REFUNDED payment', () => {
    const payment: PaymentLike = {
      amount: d('100'),
      status: 'PARTIALLY_REFUNDED',
      refunds: [{ amount: d('30'), status: 'SUCCESSFUL' }],
    };
    expect(paymentNetAmount(payment).toString()).toBe('70');
  });

  it('nets to zero for a fully REFUNDED payment', () => {
    const payment: PaymentLike = {
      amount: d('100'),
      status: 'REFUNDED',
      refunds: [{ amount: d('100'), status: 'SUCCESSFUL' }],
    };
    expect(paymentNetAmount(payment).toString()).toBe('0');
  });

  it('ignores a PENDING (not-yet-successful) refund', () => {
    const payment: PaymentLike = {
      amount: d('100'),
      status: 'SUCCESSFUL',
      refunds: [{ amount: d('40'), status: 'PENDING' }],
    };
    expect(paymentNetAmount(payment).toString()).toBe('100');
  });
});

describe('computeInvoiceAmountPaid', () => {
  it('sums net amounts across multiple payments', () => {
    const payments: PaymentLike[] = [
      { amount: d('100'), status: 'SUCCESSFUL', refunds: [] },
      {
        amount: d('50'),
        status: 'PARTIALLY_REFUNDED',
        refunds: [{ amount: d('20'), status: 'SUCCESSFUL' }],
      },
      { amount: d('30'), status: 'PENDING', refunds: [] },
    ];
    expect(computeInvoiceAmountPaid(payments).toString()).toBe('130');
  });
});

describe('deriveInvoicePaymentStatus', () => {
  it('is UNPAID when nothing has been paid', () => {
    expect(deriveInvoicePaymentStatus(d('100'), d('0'))).toBe('UNPAID');
  });

  it('is PARTIALLY_PAID when some but not all has been paid', () => {
    expect(deriveInvoicePaymentStatus(d('100'), d('40'))).toBe(
      'PARTIALLY_PAID',
    );
  });

  it('is PAID once the amount paid meets the total', () => {
    expect(deriveInvoicePaymentStatus(d('100'), d('100'))).toBe('PAID');
  });

  it('is PAID even if overpaid (never a negative balance state)', () => {
    expect(deriveInvoicePaymentStatus(d('100'), d('120'))).toBe('PAID');
  });
});

describe('formatInvoiceNumber', () => {
  it('zero-pads to six digits', () => {
    expect(formatInvoiceNumber(42)).toBe('INV-000042');
  });

  it('does not truncate a number wider than six digits', () => {
    expect(formatInvoiceNumber(1234567)).toBe('INV-1234567');
  });
});

describe('computeFolioTotals', () => {
  it('adds the room charge and every folio charge, then subtracts what has been paid', () => {
    const result = computeFolioTotals(
      d('500'),
      [{ amount: d('50') }, { amount: d('25') }],
      d('300'),
    );
    expect(result.totalCharges.toString()).toBe('575');
    expect(result.totalPaid.toString()).toBe('300');
    expect(result.balanceDue.toString()).toBe('275');
  });

  it('handles a folio with no incidental charges', () => {
    const result = computeFolioTotals(d('200'), [], d('0'));
    expect(result.totalCharges.toString()).toBe('200');
    expect(result.balanceDue.toString()).toBe('200');
  });
});
