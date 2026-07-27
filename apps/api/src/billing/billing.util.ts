import type {
  InvoicePaymentStatus,
  PaymentStatus,
  RefundStatus,
} from '@nugget/shared-types';
import { Prisma } from '../generated/prisma/client';

export interface RefundLike {
  amount: Prisma.Decimal;
  status: RefundStatus;
}

export interface PaymentLike {
  amount: Prisma.Decimal;
  status: PaymentStatus;
  refunds: RefundLike[];
}

/**
 * What a payment actually contributes to an invoice's paid total: its full
 * amount minus any refunds that have actually succeeded against it. PENDING
 * and FAILED payments contribute nothing. This one formula covers
 * SUCCESSFUL, PARTIALLY_REFUNDED, and REFUNDED uniformly — a fully refunded
 * payment's net amount naturally comes out to zero without a separate branch.
 */
export function paymentNetAmount(payment: PaymentLike): Prisma.Decimal {
  if (payment.status === 'PENDING' || payment.status === 'FAILED') {
    return new Prisma.Decimal(0);
  }
  const refunded = payment.refunds
    .filter((r) => r.status === 'SUCCESSFUL')
    .reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0));
  return payment.amount.sub(refunded);
}

export function computeInvoiceAmountPaid(
  payments: PaymentLike[],
): Prisma.Decimal {
  return payments.reduce(
    (sum, p) => sum.add(paymentNetAmount(p)),
    new Prisma.Decimal(0),
  );
}

/**
 * ISSUED/VOID is the only lifecycle Invoice stores (schema.prisma); whether
 * it's actually paid is derived here from the ledger so it can never
 * disagree with the Payment/Refund rows that are the source of truth.
 */
export function deriveInvoicePaymentStatus(
  totalAmount: Prisma.Decimal,
  amountPaid: Prisma.Decimal,
): InvoicePaymentStatus {
  if (amountPaid.lte(0)) return 'UNPAID';
  if (amountPaid.gte(totalAmount)) return 'PAID';
  return 'PARTIALLY_PAID';
}

export function formatInvoiceNumber(sequenceNumber: number): string {
  return `INV-${sequenceNumber.toString().padStart(6, '0')}`;
}

export interface FolioTotals {
  totalCharges: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
}

/**
 * PRD §5.7's unified folio total: the booking's own room charge (already
 * includes any early-check-in/late-check-out fee, per Milestone 3) plus
 * every incidental FolioCharge, minus whatever has actually been paid
 * across every non-VOID invoice issued against this booking.
 */
export function computeFolioTotals(
  roomCharge: Prisma.Decimal,
  charges: { amount: Prisma.Decimal }[],
  paidAcrossInvoices: Prisma.Decimal,
): FolioTotals {
  const totalCharges = charges.reduce(
    (sum, c) => sum.add(c.amount),
    roomCharge,
  );
  const balanceDue = totalCharges.sub(paidAcrossInvoices);
  return { totalCharges, totalPaid: paidAcrossInvoices, balanceDue };
}
