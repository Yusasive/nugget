import type { PaginationQuery } from "./pagination";

export const ROOM_BOARD_STATUSES = ["VACANT", "OCCUPIED", "DIRTY", "OUT_OF_ORDER"] as const;
export type RoomBoardStatus = (typeof ROOM_BOARD_STATUSES)[number];

export interface RoomStatusBoardQuery extends PaginationQuery {
  status?: RoomBoardStatus;
  roomTypeId?: string;
  search?: string;
  /** Only meaningful for Super Admin — every other role is already
   * branch-scoped server-side regardless of what's passed here. */
  branchId?: string;
}

export interface RoomBoardBookingSummary {
  id: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface RoomStatusBoardEntry {
  room: { id: string; roomNumber: string; floor: string | null; roomType: { id: string; name: string } };
  status: RoomBoardStatus;
  /** The CHECKED_IN booking currently occupying this room, if any. */
  activeBooking: RoomBoardBookingSummary | null;
  /** A CONFIRMED booking whose checkInDate has arrived but hasn't checked in yet. */
  arrivalToday: RoomBoardBookingSummary | null;
}
