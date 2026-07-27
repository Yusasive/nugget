import type { TourBookingDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';
import { TOUR_DEPARTURE_INCLUDE } from './tour-departure.mapper';

export const TOUR_BOOKING_INCLUDE = {
  tourDeparture: { include: TOUR_DEPARTURE_INCLUDE },
  guest: true,
} as const;

export type TourBookingWithRelations = Prisma.TourBookingGetPayload<{
  include: typeof TOUR_BOOKING_INCLUDE;
}>;

/** tourDepartureAvailableSeats is computed by the caller (same "computed,
 * not stored" seats logic used everywhere else in this module). */
export function toTourBookingDto(
  booking: TourBookingWithRelations,
  tourDepartureAvailableSeats: number,
): TourBookingDto {
  return {
    id: booking.id,
    branchId: booking.branchId,
    seats: booking.seats,
    status: booking.status,
    holdExpiresAt: booking.holdExpiresAt
      ? booking.holdExpiresAt.toISOString()
      : null,
    totalAmount: booking.totalAmount.toString(),
    source: booking.source,
    linkedBookingId: booking.linkedBookingId,
    notes: booking.notes,
    createdAt: booking.createdAt.toISOString(),
    tourDeparture: {
      id: booking.tourDeparture.id,
      branchId: booking.tourDeparture.branchId,
      departureAt: booking.tourDeparture.departureAt.toISOString(),
      returnAt: booking.tourDeparture.returnAt.toISOString(),
      totalSeats: booking.tourDeparture.totalSeats,
      availableSeats: tourDepartureAvailableSeats,
      pricePerSeat: booking.tourDeparture.pricePerSeat.toString(),
      status: booking.tourDeparture.status,
      notes: booking.tourDeparture.notes,
      createdAt: booking.tourDeparture.createdAt.toISOString(),
      tourPackage: {
        id: booking.tourDeparture.tourPackage.id,
        name: booking.tourDeparture.tourPackage.name,
        durationMinutes: booking.tourDeparture.tourPackage.durationMinutes,
      },
      guide: {
        id: booking.tourDeparture.guide.id,
        fullName: booking.tourDeparture.guide.fullName,
      },
      vehicle: {
        id: booking.tourDeparture.vehicle.id,
        name: booking.tourDeparture.vehicle.name,
      },
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
