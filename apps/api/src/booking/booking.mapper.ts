import type { BookingDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    room: { include: { roomType: true } };
    ratePlan: true;
    guest: true;
  };
}>;

export const BOOKING_INCLUDE = {
  room: { include: { roomType: true } },
  ratePlan: true,
  guest: true,
} as const;

export function toBookingDto(booking: BookingWithRelations): BookingDto {
  return {
    id: booking.id,
    branchId: booking.branchId,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
    status: booking.status,
    holdExpiresAt: booking.holdExpiresAt
      ? booking.holdExpiresAt.toISOString()
      : null,
    totalAmount: booking.totalAmount.toString(),
    source: booking.source,
    notes: booking.notes,
    checkedInAt: booking.checkedInAt ? booking.checkedInAt.toISOString() : null,
    checkedOutAt: booking.checkedOutAt
      ? booking.checkedOutAt.toISOString()
      : null,
    depositAmount: booking.depositAmount
      ? booking.depositAmount.toString()
      : null,
    earlyCheckInFee: booking.earlyCheckInFee
      ? booking.earlyCheckInFee.toString()
      : null,
    lateCheckOutFee: booking.lateCheckOutFee
      ? booking.lateCheckOutFee.toString()
      : null,
    createdAt: booking.createdAt.toISOString(),
    room: {
      id: booking.room.id,
      roomNumber: booking.room.roomNumber,
      roomType: {
        id: booking.room.roomType.id,
        name: booking.room.roomType.name,
      },
    },
    ratePlan: {
      id: booking.ratePlan.id,
      name: booking.ratePlan.name,
      type: booking.ratePlan.type,
      pricePerNight: booking.ratePlan.pricePerNight.toString(),
    },
    guest: {
      id: booking.guest.id,
      firstName: booking.guest.firstName,
      lastName: booking.guest.lastName,
      email: booking.guest.email,
      phone: booking.guest.phone,
    },
  };
}
