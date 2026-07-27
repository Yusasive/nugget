import type { PaginationQuery } from "./pagination";

export interface ListBranchesQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

export interface BranchDto {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  /** "HH:mm" 24h — PRD §5.3 early check-in fee threshold. */
  standardCheckInTime: string;
  /** "HH:mm" 24h — PRD §5.3 late check-out fee threshold. */
  standardCheckOutTime: string;
  earlyCheckInFeeAmount: string | null;
  lateCheckOutFeeAmount: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchRequestBody {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface UpdateBranchRequestBody {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  standardCheckInTime?: string;
  standardCheckOutTime?: string;
  earlyCheckInFeeAmount?: string;
  lateCheckOutFeeAmount?: string;
}
