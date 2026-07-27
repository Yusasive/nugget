import type { PaginationQuery } from "./pagination";

export const BOOKING_STATUSES = [
  "HELD",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "EXPIRED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_SOURCES = ["STAFF_MANUAL", "GUEST_ONLINE"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export interface ListBookingsQuery extends PaginationQuery {
  status?: BookingStatus;
  /** Matches against guest first/last name or email. */
  guestSearch?: string;
  checkInDateFrom?: string;
  checkInDateTo?: string;
  checkOutDateFrom?: string;
  checkOutDateTo?: string;
}

export interface GuestDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

export interface GuestInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface BookingDto {
  id: string;
  branchId: string;
  checkInDate: string;
  checkOutDate: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
  totalAmount: string;
  source: BookingSource;
  notes: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  depositAmount: string | null;
  earlyCheckInFee: string | null;
  lateCheckOutFee: string | null;
  createdAt: string;
  room: { id: string; roomNumber: string; roomType: { id: string; name: string } };
  ratePlan: { id: string; name: string; type: string; pricePerNight: string };
  guest: GuestDto;
}

/** Staff-side creation: an existing guestId, or inline details for a new one. */
export interface CreateBookingRequestBody {
  roomId: string;
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  guestId?: string;
  guest?: GuestInput;
  notes?: string;
}

/** Public/unauthenticated creation — branchId is explicit since there's no actor context to scope by. */
export interface CreatePublicBookingRequestBody {
  branchId: string;
  roomId: string;
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  guest: GuestInput;
}

export interface RoomAvailabilityQuery {
  branchId: string;
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
}

export interface AvailableRoomDto {
  id: string;
  roomNumber: string;
  floor: string | null;
  roomType: { id: string; name: string; maxOccupancy: number };
}

export interface CancelBookingRequestBody {
  reason?: string;
}

/** PRD §5.3: "room assignment" — omit roomId to check into the room already
 * booked; provide it to assign a different one at arrival. */
export interface CheckInRequestBody {
  roomId?: string;
  depositAmount?: string;
}

export interface RoomTransferRequestBody {
  toRoomId: string;
  reason?: string;
}
