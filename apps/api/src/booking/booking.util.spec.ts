import { BadRequestException } from '@nestjs/common';
import {
  activeBookingStatusWhere,
  assertValidStayRange,
  combineDateAndTime,
  dateRangeOverlapWhere,
  isEarlyCheckIn,
  isLateCheckOut,
  nightsBetween,
  parseDateOnly,
} from './booking.util';

describe('parseDateOnly', () => {
  it('normalizes to UTC midnight regardless of time-of-day in the input', () => {
    const date = parseDateOnly('2026-08-01T15:42:00Z', 'checkInDate');
    expect(date.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('rejects an unparseable date', () => {
    expect(() => parseDateOnly('not-a-date', 'checkInDate')).toThrow(
      BadRequestException,
    );
  });
});

describe('nightsBetween', () => {
  it('counts whole nights between two dates', () => {
    const checkIn = parseDateOnly('2026-08-01', 'checkInDate');
    const checkOut = parseDateOnly('2026-08-04', 'checkOutDate');
    expect(nightsBetween(checkIn, checkOut)).toBe(3);
  });
});

describe('assertValidStayRange', () => {
  it('rejects a checkout on or before checkin', () => {
    const day = parseDateOnly('2026-08-01', 'd');
    expect(() => assertValidStayRange(day, day)).toThrow(BadRequestException);
  });

  it('accepts a checkout after checkin', () => {
    const checkIn = parseDateOnly('2026-08-01', 'checkInDate');
    const checkOut = parseDateOnly('2026-08-02', 'checkOutDate');
    expect(() => assertValidStayRange(checkIn, checkOut)).not.toThrow();
  });
});

describe('dateRangeOverlapWhere', () => {
  it('builds a half-open-interval overlap condition', () => {
    const checkIn = parseDateOnly('2026-08-05', 'checkInDate');
    const checkOut = parseDateOnly('2026-08-08', 'checkOutDate');
    expect(dateRangeOverlapWhere(checkIn, checkOut)).toEqual({
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
    });
  });
});

describe('activeBookingStatusWhere', () => {
  it('always counts CONFIRMED and CHECKED_IN, and only counts HELD while unexpired', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(activeBookingStatusWhere(now)).toEqual({
      OR: [
        { status: 'CONFIRMED' },
        { status: 'CHECKED_IN' },
        {
          status: 'HELD',
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
        },
      ],
    });
  });
});

describe('combineDateAndTime', () => {
  it('applies an "HH:mm" time onto a date-only value in UTC', () => {
    const day = parseDateOnly('2026-08-01', 'd');
    expect(combineDateAndTime(day, '14:30').toISOString()).toBe(
      '2026-08-01T14:30:00.000Z',
    );
  });
});

describe('isEarlyCheckIn', () => {
  it('is true when arriving before the branch standard check-in time', () => {
    const checkInDate = parseDateOnly('2026-08-01', 'd');
    const now = new Date('2026-08-01T10:00:00Z');
    expect(isEarlyCheckIn(now, checkInDate, '14:00')).toBe(true);
  });

  it('is false when arriving at or after the branch standard check-in time', () => {
    const checkInDate = parseDateOnly('2026-08-01', 'd');
    const now = new Date('2026-08-01T15:00:00Z');
    expect(isEarlyCheckIn(now, checkInDate, '14:00')).toBe(false);
  });
});

describe('isLateCheckOut', () => {
  it('is true when leaving after the branch standard check-out time', () => {
    const checkOutDate = parseDateOnly('2026-08-05', 'd');
    const now = new Date('2026-08-05T13:00:00Z');
    expect(isLateCheckOut(now, checkOutDate, '12:00')).toBe(true);
  });

  it('is false when leaving at or before the branch standard check-out time', () => {
    const checkOutDate = parseDateOnly('2026-08-05', 'd');
    const now = new Date('2026-08-05T11:00:00Z');
    expect(isLateCheckOut(now, checkOutDate, '12:00')).toBe(false);
  });
});
