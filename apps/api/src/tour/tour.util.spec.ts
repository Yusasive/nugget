import { BadRequestException } from '@nestjs/common';
import {
  activeTourBookingStatusWhere,
  assertValidDepartureRange,
  parseDepartureDate,
} from './tour.util';

describe('parseDepartureDate', () => {
  it('parses a valid ISO datetime', () => {
    const date = parseDepartureDate('2026-08-01T09:00:00Z', 'departureAt');
    expect(date.toISOString()).toBe('2026-08-01T09:00:00.000Z');
  });

  it('rejects an unparseable date', () => {
    expect(() => parseDepartureDate('not-a-date', 'departureAt')).toThrow(
      BadRequestException,
    );
  });
});

describe('assertValidDepartureRange', () => {
  it('rejects a returnAt on or before departureAt', () => {
    const at = new Date('2026-08-01T09:00:00Z');
    expect(() => assertValidDepartureRange(at, at)).toThrow(
      BadRequestException,
    );
  });

  it('accepts a returnAt after departureAt', () => {
    const departureAt = new Date('2026-08-01T09:00:00Z');
    const returnAt = new Date('2026-08-01T13:00:00Z');
    expect(() =>
      assertValidDepartureRange(departureAt, returnAt),
    ).not.toThrow();
  });
});

describe('activeTourBookingStatusWhere', () => {
  it('always counts CONFIRMED, and only counts HELD while unexpired', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(activeTourBookingStatusWhere(now)).toEqual({
      OR: [
        { status: 'CONFIRMED' },
        {
          status: 'HELD',
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
        },
      ],
    });
  });
});
