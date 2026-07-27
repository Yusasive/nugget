import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { GuestInput } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export function assertValidDepartureRange(
  departureAt: Date,
  returnAt: Date,
): void {
  if (returnAt <= departureAt) {
    throw new BadRequestException('returnAt must be after departureAt');
  }
}

export function parseDepartureDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid date`);
  }
  return date;
}

/**
 * Mirrors booking.util.ts's activeBookingStatusWhere for TourBooking:
 * CONFIRMED always counts against a departure's seats; HELD only counts
 * while its hold hasn't expired; CANCELLED/EXPIRED never count.
 */
export function activeTourBookingStatusWhere(now: Date) {
  return {
    OR: [
      { status: 'CONFIRMED' as const },
      {
        status: 'HELD' as const,
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
      },
    ],
  };
}

/**
 * Find-or-create a Guest by email — duplicated from booking.service.ts's
 * private resolveGuestId rather than shared, since exporting a 15-line
 * helper out of M2's BookingService isn't worth the refactor risk for this
 * milestone.
 */
export async function resolveGuestId(
  tx: Prisma.TransactionClient,
  guestId: string | undefined,
  guestInput: GuestInput | undefined,
): Promise<string> {
  if (guestId) {
    const guest = await tx.guest.findUnique({ where: { id: guestId } });
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }
    return guest.id;
  }

  if (!guestInput) {
    throw new BadRequestException(
      'Either guestId or guest details are required',
    );
  }

  if (guestInput.email) {
    const existing = await tx.guest.findFirst({
      where: { email: guestInput.email },
    });
    if (existing) {
      return existing.id;
    }
  }

  const created = await tx.guest.create({
    data: {
      firstName: guestInput.firstName,
      lastName: guestInput.lastName,
      email: guestInput.email,
      phone: guestInput.phone,
    },
  });
  return created.id;
}
