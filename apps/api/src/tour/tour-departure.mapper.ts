import type { TourDepartureDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const TOUR_DEPARTURE_INCLUDE = {
  tourPackage: true,
  guide: true,
  vehicle: true,
} as const;

export type TourDepartureWithRelations = Prisma.TourDepartureGetPayload<{
  include: typeof TOUR_DEPARTURE_INCLUDE;
}>;

/** availableSeats is computed by the caller (sum of active bookings' seats
 * subtracted from totalSeats) — never stored, see schema.prisma. */
export function toTourDepartureDto(
  departure: TourDepartureWithRelations,
  availableSeats: number,
): TourDepartureDto {
  return {
    id: departure.id,
    branchId: departure.branchId,
    departureAt: departure.departureAt.toISOString(),
    returnAt: departure.returnAt.toISOString(),
    totalSeats: departure.totalSeats,
    availableSeats,
    pricePerSeat: departure.pricePerSeat.toString(),
    status: departure.status,
    notes: departure.notes,
    createdAt: departure.createdAt.toISOString(),
    tourPackage: {
      id: departure.tourPackage.id,
      name: departure.tourPackage.name,
      durationMinutes: departure.tourPackage.durationMinutes,
    },
    guide: { id: departure.guide.id, fullName: departure.guide.fullName },
    vehicle: { id: departure.vehicle.id, name: departure.vehicle.name },
  };
}
