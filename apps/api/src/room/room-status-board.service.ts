import { Inject, Injectable } from '@nestjs/common';
import type {
  PaginatedResponse,
  RoomBoardBookingSummary,
  RoomBoardStatus,
  RoomStatusBoardEntry,
} from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import type { Prisma } from '../generated/prisma/client';
import type { RoomStatusBoardQueryDto } from './dto/room-status-board-query.dto';

type BoardBooking = Prisma.BookingGetPayload<{ include: { guest: true } }>;

function toSummary(booking: BoardBooking): RoomBoardBookingSummary {
  return {
    id: booking.id,
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
  };
}

/** The board's status is computed from isOutOfOrder/housekeepingStatus/an
 * active CHECKED_IN booking (see the class doc comment) — filtering by it
 * means expressing that same computation as a `where` clause so it can be
 * pushed to the database and paginated properly, rather than fetching
 * everything and filtering in memory. */
function statusWhere(status: RoomBoardStatus): Prisma.RoomWhereInput {
  const notCheckedIn: Prisma.RoomWhereInput = {
    bookings: { none: { status: 'CHECKED_IN' } },
  };
  switch (status) {
    case 'OUT_OF_ORDER':
      return { isOutOfOrder: true };
    case 'OCCUPIED':
      return {
        isOutOfOrder: false,
        bookings: { some: { status: 'CHECKED_IN' } },
      };
    case 'DIRTY':
      return {
        isOutOfOrder: false,
        housekeepingStatus: 'DIRTY',
        ...notCheckedIn,
      };
    case 'VACANT':
      return {
        isOutOfOrder: false,
        housekeepingStatus: 'CLEAN',
        ...notCheckedIn,
      };
  }
}

/**
 * PRD §5.3's real-time room-status board: vacant / occupied / dirty /
 * out-of-order. Status is computed, not stored — see the Room model's doc
 * comment in schema.prisma. The frontend polls this (TRD §7: short-interval
 * polling is the correct Phase-1 mechanism, not a placeholder for one).
 */
@Injectable()
export class RoomStatusBoardService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async getBoard(
    query: RoomStatusBoardQueryDto,
  ): Promise<PaginatedResponse<RoomStatusBoardEntry>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const where: Prisma.RoomWhereInput = {
      isActive: true,
      ...(query.status ? statusWhere(query.status) : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.search
        ? { roomNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      // Only takes effect for Super Admin — the branch-scoping extension
      // force-overwrites this for every other role regardless.
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take,
        include: {
          roomType: true,
          bookings: {
            where: {
              OR: [
                { status: 'CHECKED_IN' },
                { status: 'CONFIRMED', checkInDate: { lte: today } },
              ],
            },
            include: { guest: true },
            orderBy: { checkInDate: 'asc' },
          },
        },
        orderBy: { roomNumber: 'asc' },
      }),
      this.prisma.room.count({ where }),
    ]);

    const data = rooms.map((room) => {
      const activeBooking =
        room.bookings.find((b) => b.status === 'CHECKED_IN') ?? null;
      const arrivalToday = activeBooking
        ? null
        : (room.bookings.find((b) => b.status === 'CONFIRMED') ?? null);

      let status: RoomBoardStatus;
      if (room.isOutOfOrder) {
        status = 'OUT_OF_ORDER';
      } else if (activeBooking) {
        status = 'OCCUPIED';
      } else if (room.housekeepingStatus === 'DIRTY') {
        status = 'DIRTY';
      } else {
        status = 'VACANT';
      }

      return {
        room: {
          id: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          roomType: { id: room.roomType.id, name: room.roomType.name },
        },
        status,
        activeBooking: activeBooking ? toSummary(activeBooking) : null,
        arrivalToday: arrivalToday ? toSummary(arrivalToday) : null,
      };
    });

    return buildPaginatedResponse(data, total, page, pageSize);
  }
}
