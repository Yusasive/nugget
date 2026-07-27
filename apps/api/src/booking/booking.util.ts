import { BadRequestException } from '@nestjs/common';

/** Stays are night-based; normalize to UTC midnight so "2026-08-01" always
 * means the same instant regardless of the caller's local timezone. */
export function parseDateOnly(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid date`);
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}

export function assertValidStayRange(checkIn: Date, checkOut: Date): void {
  if (checkOut <= checkIn) {
    throw new BadRequestException('checkOutDate must be after checkInDate');
  }
}

/**
 * The Prisma `where` fragment for "a booking that actually holds the room
 * right now": CONFIRMED and CHECKED_IN always count; HELD only counts while
 * its hold hasn't expired; CHECKED_OUT does not count (the guest has left —
 * housekeepingStatus is what gates the room after that, not this). Shared by
 * the availability search and the overlap check inside booking creation so
 * the two can never disagree about what "available" means.
 */
export function activeBookingStatusWhere(now: Date) {
  return {
    OR: [
      { status: 'CONFIRMED' as const },
      { status: 'CHECKED_IN' as const },
      {
        status: 'HELD' as const,
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
      },
    ],
  };
}

/** Two [checkIn, checkOut) ranges overlap iff each starts before the other ends. */
export function dateRangeOverlapWhere(checkIn: Date, checkOut: Date) {
  return {
    checkInDate: { lt: checkOut },
    checkOutDate: { gt: checkIn },
  };
}

/** Combines a date-only value with a branch's "HH:mm" policy time into one instant. */
export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setUTCHours(hours, minutes, 0, 0);
  return combined;
}

/** PRD §5.3: arriving before the branch's standard check-in time triggers this fee. */
export function isEarlyCheckIn(
  now: Date,
  checkInDate: Date,
  standardCheckInTime: string,
): boolean {
  return now < combineDateAndTime(checkInDate, standardCheckInTime);
}

/** PRD §5.3: leaving after the branch's standard check-out time triggers this fee. */
export function isLateCheckOut(
  now: Date,
  checkOutDate: Date,
  standardCheckOutTime: string,
): boolean {
  return now > combineDateAndTime(checkOutDate, standardCheckOutTime);
}
