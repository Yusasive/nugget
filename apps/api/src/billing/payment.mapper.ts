import type { PaymentDto, RefundDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const REFUND_INCLUDE = {
  processedByStaff: true,
} as const;

export const PAYMENT_INCLUDE = {
  recordedByStaff: true,
  refunds: { include: REFUND_INCLUDE, orderBy: { createdAt: 'asc' } },
} as const;

export type RefundWithRelations = Prisma.RefundGetPayload<{
  include: typeof REFUND_INCLUDE;
}>;
export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_INCLUDE;
}>;

export function toRefundDto(refund: RefundWithRelations): RefundDto {
  return {
    id: refund.id,
    paymentId: refund.paymentId,
    amount: refund.amount.toString(),
    reason: refund.reason,
    provider: refund.provider,
    providerReference: refund.providerReference,
    status: refund.status,
    processedByStaff: refund.processedByStaff
      ? {
          id: refund.processedByStaff.id,
          firstName: refund.processedByStaff.firstName,
          lastName: refund.processedByStaff.lastName,
        }
      : null,
    processedAt: refund.processedAt ? refund.processedAt.toISOString() : null,
    createdAt: refund.createdAt.toISOString(),
  };
}

export function toPaymentDto(payment: PaymentWithRelations): PaymentDto {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    amount: payment.amount.toString(),
    method: payment.method,
    provider: payment.provider,
    providerReference: payment.providerReference,
    status: payment.status,
    recordedByStaff: payment.recordedByStaff
      ? {
          id: payment.recordedByStaff.id,
          firstName: payment.recordedByStaff.firstName,
          lastName: payment.recordedByStaff.lastName,
        }
      : null,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    failureReason: payment.failureReason,
    refunds: payment.refunds.map(toRefundDto),
    createdAt: payment.createdAt.toISOString(),
  };
}
