import type {
  CashReportDto,
  ShiftDto,
  ShiftTransactionDto,
} from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const SHIFT_TRANSACTION_INCLUDE = {
  recordedByStaff: true,
} as const;

export const SHIFT_INCLUDE = {
  staff: true,
  transactions: {
    include: SHIFT_TRANSACTION_INCLUDE,
    orderBy: { recordedAt: 'asc' },
  },
  cashReport: true,
} as const;

export type ShiftTransactionWithRelations = Prisma.ShiftTransactionGetPayload<{
  include: typeof SHIFT_TRANSACTION_INCLUDE;
}>;

export type ShiftWithRelations = Prisma.ShiftGetPayload<{
  include: typeof SHIFT_INCLUDE;
}>;

export function toShiftTransactionDto(
  transaction: ShiftTransactionWithRelations,
): ShiftTransactionDto {
  return {
    id: transaction.id,
    shiftId: transaction.shiftId,
    type: transaction.type,
    amount: transaction.amount.toString(),
    description: transaction.description,
    bookingId: transaction.bookingId,
    recordedByStaff: {
      id: transaction.recordedByStaff.id,
      firstName: transaction.recordedByStaff.firstName,
      lastName: transaction.recordedByStaff.lastName,
    },
    recordedAt: transaction.recordedAt.toISOString(),
  };
}

export function toCashReportDto(
  report: Prisma.CashReportGetPayload<Record<string, never>>,
): CashReportDto {
  return {
    id: report.id,
    shiftId: report.shiftId,
    totalSales: report.totalSales.toString(),
    totalCashCollected: report.totalCashCollected.toString(),
    discrepancy: report.discrepancy.toString(),
    notes: report.notes,
    createdAt: report.createdAt.toISOString(),
  };
}

export function toShiftDto(shift: ShiftWithRelations): ShiftDto {
  return {
    id: shift.id,
    branchId: shift.branchId,
    staff: {
      id: shift.staff.id,
      firstName: shift.staff.firstName,
      lastName: shift.staff.lastName,
    },
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    openingCash: shift.openingCash.toString(),
    closingCashExpected: shift.closingCashExpected
      ? shift.closingCashExpected.toString()
      : null,
    closingCashActual: shift.closingCashActual
      ? shift.closingCashActual.toString()
      : null,
    status: shift.status,
    notes: shift.notes,
    transactions: shift.transactions.map(toShiftTransactionDto),
    cashReport: shift.cashReport ? toCashReportDto(shift.cashReport) : null,
  };
}
