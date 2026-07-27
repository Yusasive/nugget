import type { PaginationQuery } from './pagination';

export interface GuestProfileDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  preferences: string | null;
  notes: string | null;
  isVip: boolean;
  isBlacklisted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateGuestRequestBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  preferences?: string;
  notes?: string;
  isVip?: boolean;
  isBlacklisted?: boolean;
}

export interface ListGuestsQuery extends PaginationQuery {
  search?: string;
  isVip?: boolean;
  isBlacklisted?: boolean;
}
