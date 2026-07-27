import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" → the UTC-midnight [start, end) bounds of that calendar month. */
export function parseMonthRange(month: string): { start: Date; end: Date } {
  if (!MONTH_PATTERN.test(month)) {
    throw new BadRequestException('month must look like "2026-07"');
  }
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 1));
  return { start, end };
}

/** Explicit from/to (UTC-midnight, [start, end) half-open) or, when either
 * is omitted, the trailing `defaultDays` up to and including today —
 * matches every other report's "no date range given" behavior. */
export function parseDateRange(
  from: string | undefined,
  to: string | undefined,
  defaultDays = 30,
): { start: Date; end: Date } {
  const now = new Date();
  const todayEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const end = to
    ? new Date(
        Date.UTC(
          new Date(to).getUTCFullYear(),
          new Date(to).getUTCMonth(),
          new Date(to).getUTCDate() + 1,
        ),
      )
    : todayEnd;
  const start = from
    ? new Date(
        Date.UTC(
          new Date(from).getUTCFullYear(),
          new Date(from).getUTCMonth(),
          new Date(from).getUTCDate(),
        ),
      )
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  if (end <= start) {
    throw new BadRequestException('to must be after from');
  }
  return { start, end };
}

/** Nights of a [checkIn, checkOut) stay that fall within [periodStart,
 * periodEnd) — the building block for occupancy/ADR/RevPAR, since a stay
 * spanning a period boundary should only count the nights actually inside
 * the reporting window. */
export function nightsOverlap(
  checkIn: Date,
  checkOut: Date,
  periodStart: Date,
  periodEnd: Date,
): number {
  const overlapStart = checkIn > periodStart ? checkIn : periodStart;
  const overlapEnd = checkOut < periodEnd ? checkOut : periodEnd;
  const ms = overlapEnd.getTime() - overlapStart.getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export interface OccupancyBookingInput {
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: Prisma.Decimal;
}

export interface OccupancyMetrics {
  availableRoomNights: number;
  occupiedRoomNights: number;
  occupancyRate: Prisma.Decimal;
  roomRevenue: Prisma.Decimal;
  adr: Prisma.Decimal;
  revPar: Prisma.Decimal;
}

/**
 * PRD §5.14's occupancy/ADR/RevPAR. Each booking's totalAmount is assumed
 * flat-rate across its full stay (the same assumption BookingService makes
 * when it computes totalAmount as pricePerNight × nights at creation time),
 * so a stay's per-night revenue is totalAmount / totalNights, and only the
 * nights that actually fall inside the reporting period count toward both
 * occupiedRoomNights and roomRevenue.
 */
export function computeOccupancyMetrics(
  bookings: OccupancyBookingInput[],
  activeRoomCount: number,
  periodStart: Date,
  periodEnd: Date,
): OccupancyMetrics {
  const periodDays = Math.round(
    (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000),
  );
  const availableRoomNights = activeRoomCount * periodDays;

  let occupiedRoomNights = 0;
  let roomRevenue = new Prisma.Decimal(0);
  for (const booking of bookings) {
    const overlap = nightsOverlap(
      booking.checkInDate,
      booking.checkOutDate,
      periodStart,
      periodEnd,
    );
    if (overlap <= 0) continue;
    const totalNights = Math.max(
      1,
      Math.round(
        (booking.checkOutDate.getTime() - booking.checkInDate.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );
    // Rounded to money precision immediately — totalAmount/totalNights
    // rarely divides evenly (e.g. ₦100/3 nights), and an unrounded
    // Prisma.Decimal division carries decimal.js's full default precision
    // (20 significant digits) all the way out to the API response.
    const perNight = booking.totalAmount.div(totalNights).toDecimalPlaces(2);
    occupiedRoomNights += overlap;
    roomRevenue = roomRevenue.add(perNight.mul(overlap));
  }

  const occupancyRate =
    availableRoomNights > 0
      ? new Prisma.Decimal(occupiedRoomNights)
          .div(availableRoomNights)
          .toDecimalPlaces(4)
      : new Prisma.Decimal(0);
  const adr =
    occupiedRoomNights > 0
      ? roomRevenue.div(occupiedRoomNights).toDecimalPlaces(2)
      : new Prisma.Decimal(0);
  const revPar =
    availableRoomNights > 0
      ? roomRevenue.div(availableRoomNights).toDecimalPlaces(2)
      : new Prisma.Decimal(0);

  return {
    availableRoomNights,
    occupiedRoomNights,
    occupancyRate,
    roomRevenue,
    adr,
    revPar,
  };
}

/** Minimal CSV serializer — values are stringified and quoted only when
 * they contain a comma/quote/newline, no dependency needed for the
 * report-shaped, all-scalar rows this codebase ever exports. */
export function toCsv<
  T extends Record<string, string | number | boolean | null | undefined>,
>(columns: { key: keyof T & string; label: string }[], rows: T[]): string {
  const escape = (
    value: string | number | boolean | null | undefined,
  ): string => {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escape(row[c.key])).join(','),
  );
  return [header, ...lines].join('\n');
}
