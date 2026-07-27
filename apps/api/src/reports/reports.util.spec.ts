import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  computeOccupancyMetrics,
  nightsOverlap,
  parseDateRange,
  parseMonthRange,
  toCsv,
} from './reports.util';

describe('parseMonthRange', () => {
  it('resolves the UTC bounds of a calendar month', () => {
    const { start, end } = parseMonthRange('2026-07');
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('rolls over into January of the next year', () => {
    const { start, end } = parseMonthRange('2026-12');
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('rejects a malformed month', () => {
    expect(() => parseMonthRange('2026-13')).toThrow(BadRequestException);
    expect(() => parseMonthRange('not-a-month')).toThrow(BadRequestException);
  });
});

describe('parseDateRange', () => {
  it('uses explicit from/to as a half-open UTC range', () => {
    const { start, end } = parseDateRange('2026-07-01', '2026-07-05');
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-06T00:00:00.000Z');
  });

  it('rejects a to before from', () => {
    expect(() => parseDateRange('2026-07-05', '2026-07-01')).toThrow(
      BadRequestException,
    );
  });
});

describe('nightsOverlap', () => {
  const period = {
    start: new Date('2026-07-01T00:00:00Z'),
    end: new Date('2026-07-08T00:00:00Z'),
  };

  it('counts the full stay when it sits inside the period', () => {
    const nights = nightsOverlap(
      new Date('2026-07-02T00:00:00Z'),
      new Date('2026-07-04T00:00:00Z'),
      period.start,
      period.end,
    );
    expect(nights).toBe(2);
  });

  it('clips a stay that starts before the period', () => {
    const nights = nightsOverlap(
      new Date('2026-06-28T00:00:00Z'),
      new Date('2026-07-03T00:00:00Z'),
      period.start,
      period.end,
    );
    expect(nights).toBe(2);
  });

  it('clips a stay that ends after the period', () => {
    const nights = nightsOverlap(
      new Date('2026-07-06T00:00:00Z'),
      new Date('2026-07-12T00:00:00Z'),
      period.start,
      period.end,
    );
    expect(nights).toBe(2);
  });

  it('returns zero for a stay entirely outside the period', () => {
    const nights = nightsOverlap(
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-03T00:00:00Z'),
      period.start,
      period.end,
    );
    expect(nights).toBe(0);
  });
});

describe('computeOccupancyMetrics', () => {
  it('computes occupancy/ADR/RevPAR from overlapping bookings', () => {
    const periodStart = new Date('2026-07-01T00:00:00Z');
    const periodEnd = new Date('2026-07-11T00:00:00Z'); // 10 days
    const metrics = computeOccupancyMetrics(
      [
        {
          checkInDate: new Date('2026-07-01T00:00:00Z'),
          checkOutDate: new Date('2026-07-05T00:00:00Z'), // 4 nights @ 100/night
          totalAmount: new Prisma.Decimal('400.00'),
        },
        {
          checkInDate: new Date('2026-07-08T00:00:00Z'),
          checkOutDate: new Date('2026-07-10T00:00:00Z'), // 2 nights @ 150/night
          totalAmount: new Prisma.Decimal('300.00'),
        },
      ],
      2, // active rooms
      periodStart,
      periodEnd,
    );

    expect(metrics.availableRoomNights).toBe(20); // 2 rooms * 10 days
    expect(metrics.occupiedRoomNights).toBe(6);
    expect(metrics.roomRevenue.toString()).toBe('700');
    expect(metrics.occupancyRate.toString()).toBe('0.3');
    // 700/6 repeats (116.666...) — rounded to money precision (2dp).
    expect(metrics.adr.toString()).toBe('116.67');
    expect(metrics.revPar.toString()).toBe('35');
  });

  it('rounds a per-night rate that does not divide evenly', () => {
    const periodStart = new Date('2026-07-01T00:00:00Z');
    const periodEnd = new Date('2026-07-04T00:00:00Z');
    const metrics = computeOccupancyMetrics(
      [
        {
          checkInDate: new Date('2026-07-01T00:00:00Z'),
          checkOutDate: new Date('2026-07-04T00:00:00Z'), // 3 nights @ 100/3 per night
          totalAmount: new Prisma.Decimal('100.00'),
        },
      ],
      1,
      periodStart,
      periodEnd,
    );
    // 100/3 = 33.333... per night, rounded to 33.33 before being multiplied
    // by the 3 overlapping nights — not the unrounded 100 you'd get by
    // multiplying first and rounding once at the end.
    expect(metrics.roomRevenue.toString()).toBe('99.99');
  });

  it('returns zeros when there are no available rooms', () => {
    const metrics = computeOccupancyMetrics(
      [],
      0,
      new Date('2026-07-01T00:00:00Z'),
      new Date('2026-07-11T00:00:00Z'),
    );
    expect(metrics.occupancyRate.toString()).toBe('0');
    expect(metrics.adr.toString()).toBe('0');
    expect(metrics.revPar.toString()).toBe('0');
  });
});

describe('toCsv', () => {
  it('serializes rows with a header, quoting values that need it', () => {
    const csv = toCsv(
      [
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount' },
      ],
      [
        { name: 'Rice, Jollof', amount: '2500' },
        { name: 'Plain "Rice"', amount: '1000' },
      ],
    );
    expect(csv).toBe(
      'Name,Amount\n"Rice, Jollof",2500\n"Plain ""Rice""",1000',
    );
  });
});
