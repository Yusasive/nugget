import type { PaginationQuery } from "./pagination";

export const SHIFT_STATUSES = ["OPEN", "CLOSED"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export interface ListShiftsQuery extends PaginationQuery {
  status?: ShiftStatus;
  /** Manager/Accountant/Super Admin only — Front Desk is always scoped to themselves regardless. */
  staffId?: string;
  openedFrom?: string;
  openedTo?: string;
}

export interface ListCashReportsQuery extends PaginationQuery {
  staffId?: string;
  closedFrom?: string;
  closedTo?: string;
}

export const SHIFT_TRANSACTION_TYPES = ["CASH_IN", "CASH_OUT"] as const;
export type ShiftTransactionType = (typeof SHIFT_TRANSACTION_TYPES)[number];

export interface ShiftStaffSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ShiftTransactionDto {
  id: string;
  shiftId: string;
  type: ShiftTransactionType;
  amount: string;
  description: string | null;
  bookingId: string | null;
  recordedByStaff: ShiftStaffSummary;
  recordedAt: string;
}

export interface CashReportDto {
  id: string;
  shiftId: string;
  totalSales: string;
  totalCashCollected: string;
  discrepancy: string;
  notes: string | null;
  createdAt: string;
}

export interface ShiftDto {
  id: string;
  branchId: string;
  staff: ShiftStaffSummary;
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  closingCashExpected: string | null;
  closingCashActual: string | null;
  status: ShiftStatus;
  notes: string | null;
  transactions: ShiftTransactionDto[];
  cashReport: CashReportDto | null;
}

export interface OpenShiftRequestBody {
  openingCash: string;
}

export interface CreateShiftTransactionRequestBody {
  type: ShiftTransactionType;
  amount: string;
  description?: string;
  bookingId?: string;
}

export interface CloseShiftRequestBody {
  closingCashActual: string;
  notes?: string;
}
