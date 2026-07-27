import type { InvoiceDto } from '@nugget/shared-types';
import {
  computeInvoiceAmountPaid,
  deriveInvoicePaymentStatus,
  formatInvoiceNumber,
} from './billing.util';
import { PAYMENT_INCLUDE, toPaymentDto } from './payment.mapper';
import type { Prisma } from '../generated/prisma/client';

export const INVOICE_INCLUDE = {
  payments: { include: PAYMENT_INCLUDE, orderBy: { createdAt: 'asc' } },
} as const;

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof INVOICE_INCLUDE;
}>;

export function toInvoiceDto(invoice: InvoiceWithRelations): InvoiceDto {
  const amountPaid = computeInvoiceAmountPaid(invoice.payments);
  const balanceDue = invoice.totalAmount.sub(amountPaid);

  return {
    id: invoice.id,
    branchId: invoice.branchId,
    bookingId: invoice.bookingId,
    tourBookingId: invoice.tourBookingId,
    restaurantOrderId: invoice.restaurantOrderId,
    guestId: invoice.guestId,
    invoiceNumber: formatInvoiceNumber(invoice.sequenceNumber),
    status: invoice.status,
    paymentStatus: deriveInvoicePaymentStatus(invoice.totalAmount, amountPaid),
    totalAmount: invoice.totalAmount.toString(),
    amountPaid: amountPaid.toString(),
    balanceDue: balanceDue.toString(),
    issuedAt: invoice.issuedAt.toISOString(),
    voidedAt: invoice.voidedAt ? invoice.voidedAt.toISOString() : null,
    payments: invoice.payments.map(toPaymentDto),
  };
}
