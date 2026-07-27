import type { PaginationQuery } from "./pagination";

export interface ListRoomTypesQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

export interface RoomTypeDto {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  maxOccupancy: number;
  amenities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomTypeRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  name: string;
  description?: string;
  maxOccupancy: number;
  amenities?: string[];
}

export interface UpdateRoomTypeRequestBody {
  name?: string;
  description?: string;
  maxOccupancy?: number;
  amenities?: string[];
  isActive?: boolean;
}

export const HOUSEKEEPING_STATUSES = ["CLEAN", "DIRTY"] as const;
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

export interface ListRoomsQuery extends PaginationQuery {
  search?: string;
  roomTypeId?: string;
  isActive?: boolean;
  isOutOfOrder?: boolean;
  housekeepingStatus?: HousekeepingStatus;
}

export interface RoomDto {
  id: string;
  branchId: string;
  roomNumber: string;
  floor: string | null;
  isOutOfOrder: boolean;
  outOfOrderReason: string | null;
  outOfOrderUntil: string | null;
  housekeepingStatus: HousekeepingStatus;
  isActive: boolean;
  createdAt: string;
  roomType: { id: string; name: string; maxOccupancy: number };
}

export interface SetRoomHousekeepingStatusRequestBody {
  housekeepingStatus: HousekeepingStatus;
}

export interface CreateRoomRequestBody {
  roomTypeId: string;
  roomNumber: string;
  floor?: string;
}

export interface UpdateRoomRequestBody {
  roomTypeId?: string;
  roomNumber?: string;
  floor?: string;
  isActive?: boolean;
}

export interface SetRoomOutOfOrderRequestBody {
  isOutOfOrder: boolean;
  reason?: string;
  until?: string;
}
