import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AvailableRoomDto,
  BookingDto,
  BookingSource,
  PaginatedResponse,
} from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { BOOKING_INCLUDE, toBookingDto } from './booking.mapper';
import {
  activeBookingStatusWhere,
  assertValidStayRange,
  dateRangeOverlapWhere,
  isEarlyCheckIn,
  isLateCheckOut,
  nightsBetween,
  parseDateOnly,
} from './booking.util';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { GuestInputDto } from './dto/guest-input.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { RoomAvailabilityQueryDto } from './dto/room-availability-query.dto';
import { RoomTransferDto } from './dto/room-transfer.dto';

interface CreateCoreParams {
  /** Non-Super-Admin staff and every public request must match this; Super
   * Admin omits it and the room's own branch is trusted instead. */
  expectedBranchId?: string;
  roomId: string;
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  guestId?: string;
  guestInput?: GuestInputDto;
  notes?: string;
  source: BookingSource;
  createdByStaffId?: string;
}

@Injectable()
export class BookingService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly redisLock: RedisLockService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async list(
    query: ListBookingsQueryDto,
  ): Promise<PaginatedResponse<BookingDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.guestSearch
        ? {
            guest: {
              OR: [
                {
                  firstName: {
                    contains: query.guestSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  lastName: {
                    contains: query.guestSearch,
                    mode: 'insensitive',
                  },
                },
                { email: { contains: query.guestSearch, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      ...(query.checkInDateFrom || query.checkInDateTo
        ? {
            checkInDate: {
              ...(query.checkInDateFrom
                ? {
                    gte: parseDateOnly(
                      query.checkInDateFrom,
                      'checkInDateFrom',
                    ),
                  }
                : {}),
              ...(query.checkInDateTo
                ? { lte: parseDateOnly(query.checkInDateTo, 'checkInDateTo') }
                : {}),
            },
          }
        : {}),
      ...(query.checkOutDateFrom || query.checkOutDateTo
        ? {
            checkOutDate: {
              ...(query.checkOutDateFrom
                ? {
                    gte: parseDateOnly(
                      query.checkOutDateFrom,
                      'checkOutDateFrom',
                    ),
                  }
                : {}),
              ...(query.checkOutDateTo
                ? {
                    lte: parseDateOnly(query.checkOutDateTo, 'checkOutDateTo'),
                  }
                : {}),
            },
          }
        : {}),
    };

    const [bookings, total] = await Promise.all([
      this.scopedPrisma.booking.findMany({
        where,
        skip,
        take,
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.scopedPrisma.booking.count({ where }),
    ]);
    return buildPaginatedResponse(
      bookings.map(toBookingDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<BookingDto> {
    const booking = await this.scopedPrisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return toBookingDto(booking);
  }

  findAvailableRoomsForStaff(
    query: RoomAvailabilityQueryDto,
  ): Promise<AvailableRoomDto[]> {
    return this.searchAvailableRooms(true, query);
  }

  findAvailableRoomsPublic(
    query: RoomAvailabilityQueryDto,
  ): Promise<AvailableRoomDto[]> {
    return this.searchAvailableRooms(false, query);
  }

  createForStaff(
    dto: CreateBookingDto,
    actor: ActorContext,
  ): Promise<BookingDto> {
    return this.createCore({
      expectedBranchId:
        actor.role === 'SUPER_ADMIN' ? undefined : actor.branchId,
      roomId: dto.roomId,
      ratePlanId: dto.ratePlanId,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      guestId: dto.guestId,
      guestInput: dto.guest,
      notes: dto.notes,
      source: 'STAFF_MANUAL',
      createdByStaffId: actor.staffId,
    });
  }

  createForGuest(dto: CreatePublicBookingDto): Promise<BookingDto> {
    return this.createCore({
      expectedBranchId: dto.branchId,
      roomId: dto.roomId,
      ratePlanId: dto.ratePlanId,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      guestInput: dto.guest,
      source: 'GUEST_ONLINE',
    });
  }

  async confirm(id: string, actor: ActorContext): Promise<BookingDto> {
    const existing = await this.scopedPrisma.booking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Booking not found');
    }
    if (existing.status !== 'HELD') {
      throw new ConflictException(
        `Cannot confirm a booking with status ${existing.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id },
        data: { status: 'CONFIRMED', holdExpiresAt: null },
        include: BOOKING_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: booking.branchId,
        action: 'booking.confirm',
        entityType: 'Booking',
        entityId: booking.id,
      });
      return toBookingDto(booking);
    });
  }

  async cancel(
    id: string,
    dto: CancelBookingDto,
    actor: ActorContext,
  ): Promise<BookingDto> {
    const existing = await this.scopedPrisma.booking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Booking not found');
    }
    if (existing.status !== 'HELD' && existing.status !== 'CONFIRMED') {
      // Covers CANCELLED/EXPIRED (already terminal) and CHECKED_IN/CHECKED_OUT
      // (the guest has arrived — check-out is the correct way to close this out now).
      throw new ConflictException(
        `Cannot cancel a booking with status ${existing.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: BOOKING_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: booking.branchId,
        action: 'booking.cancel',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: dto.reason ? { reason: dto.reason } : undefined,
      });
      return toBookingDto(booking);
    });
  }

  /**
   * PRD §5.3 check-in. `dto.roomId` lets Front Desk reassign to a different
   * room right at arrival (the originally-booked one isn't ready, say) —
   * that reassignment is validated exactly like a fresh booking (lock +
   * row-locked overlap check on the destination), but does NOT dirty the
   * originally-booked room, since nobody ever actually stayed in it.
   */
  async checkIn(
    id: string,
    dto: CheckInDto,
    actor: ActorContext,
  ): Promise<BookingDto> {
    const existing = await this.scopedPrisma.booking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Booking not found');
    }
    if (existing.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Cannot check in a booking with status ${existing.status}`,
      );
    }

    const targetRoomId = dto.roomId ?? existing.roomId;
    const isReassignment = targetRoomId !== existing.roomId;

    return this.redisLock.withLock(`lock:room:${targetRoomId}`, () =>
      this.prisma.$transaction(async (tx) => {
        const room = await tx.room.findUnique({ where: { id: targetRoomId } });
        if (!room || !room.isActive || room.branchId !== existing.branchId) {
          throw new NotFoundException('Room not found');
        }
        if (room.isOutOfOrder) {
          throw new ConflictException('This room is currently out of order');
        }
        if (room.housekeepingStatus !== 'CLEAN') {
          throw new ConflictException('This room has not been cleaned yet');
        }

        if (isReassignment) {
          const conflicts = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Booking"
            WHERE "roomId" = ${targetRoomId}
              AND id != ${existing.id}
              AND "checkInDate" < ${existing.checkOutDate}
              AND "checkOutDate" > ${existing.checkInDate}
              AND (
                status = 'CONFIRMED'
                OR status = 'CHECKED_IN'
                OR (status = 'HELD' AND ("holdExpiresAt" IS NULL OR "holdExpiresAt" > now()))
              )
            FOR UPDATE
          `;
          if (conflicts.length > 0) {
            throw new ConflictException(
              'The selected room is not available for these dates',
            );
          }
        }

        const branch = await tx.branch.findUniqueOrThrow({
          where: { id: existing.branchId },
        });
        const now = new Date();
        const earlyFee =
          isEarlyCheckIn(
            now,
            existing.checkInDate,
            branch.standardCheckInTime,
          ) && branch.earlyCheckInFeeAmount
            ? branch.earlyCheckInFeeAmount
            : null;

        const booking = await tx.booking.update({
          where: { id },
          data: {
            status: 'CHECKED_IN',
            roomId: targetRoomId,
            checkedInAt: now,
            checkedInByStaffId: actor.staffId,
            depositAmount: dto.depositAmount,
            earlyCheckInFee: earlyFee,
            totalAmount: earlyFee
              ? new Prisma.Decimal(existing.totalAmount).add(earlyFee)
              : undefined,
          },
          include: BOOKING_INCLUDE,
        });

        if (isReassignment) {
          await tx.roomTransfer.create({
            data: {
              branchId: existing.branchId,
              bookingId: id,
              fromRoomId: existing.roomId,
              toRoomId: targetRoomId,
              reason: 'Reassigned at check-in',
              transferredByStaffId: actor.staffId,
            },
          });
        }

        // PRD §5.4: a deposit collected at check-in is "daily sales entry"
        // attributed to whichever shift the collecting staff member has
        // open — automatic, not a separate manual step. No open shift is
        // not an error; the deposit is still recorded on the booking either way.
        if (dto.depositAmount) {
          const openShift = await tx.shift.findFirst({
            where: { staffId: actor.staffId, status: 'OPEN' },
          });
          if (openShift) {
            await tx.shiftTransaction.create({
              data: {
                branchId: existing.branchId,
                shiftId: openShift.id,
                type: 'CASH_IN',
                amount: dto.depositAmount,
                description: 'Check-in deposit',
                bookingId: id,
                recordedByStaffId: actor.staffId,
              },
            });
          }
        }

        await this.audit.record(tx, {
          staffId: actor.staffId,
          branchId: booking.branchId,
          action: 'booking.check-in',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: {
            earlyCheckInFee: earlyFee?.toString(),
            reassigned: isReassignment,
          },
        });

        return toBookingDto(booking);
      }),
    );
  }

  async checkOut(id: string, actor: ActorContext): Promise<BookingDto> {
    const existing = await this.scopedPrisma.booking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Booking not found');
    }
    if (existing.status !== 'CHECKED_IN') {
      throw new ConflictException(
        `Cannot check out a booking with status ${existing.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUniqueOrThrow({
        where: { id: existing.branchId },
      });
      const now = new Date();
      const lateFee =
        isLateCheckOut(
          now,
          existing.checkOutDate,
          branch.standardCheckOutTime,
        ) && branch.lateCheckOutFeeAmount
          ? branch.lateCheckOutFeeAmount
          : null;

      const booking = await tx.booking.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT',
          checkedOutAt: now,
          checkedOutByStaffId: actor.staffId,
          lateCheckOutFee: lateFee,
          totalAmount: lateFee
            ? new Prisma.Decimal(existing.totalAmount).add(lateFee)
            : undefined,
        },
        include: BOOKING_INCLUDE,
      });

      // The guest has left — the room needs cleaning before it's bookable again.
      await tx.room.update({
        where: { id: existing.roomId },
        data: { housekeepingStatus: 'DIRTY' },
      });

      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: booking.branchId,
        action: 'booking.check-out',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: { lateCheckOutFee: lateFee?.toString() },
      });

      return toBookingDto(booking);
    });
  }

  /**
   * PRD §5.3 room transfer. Only a CHECKED_IN (physically in-house) guest
   * can be transferred — reassigning a not-yet-arrived CONFIRMED booking's
   * room happens via check-in's own `roomId` override instead. The vacated
   * room is marked DIRTY automatically ("folio and housekeeping status
   * updated automatically on both rooms" — the folio stays with the same
   * Booking row, now pointing at the new room).
   */
  async transfer(
    id: string,
    dto: RoomTransferDto,
    actor: ActorContext,
  ): Promise<BookingDto> {
    const existing = await this.scopedPrisma.booking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Booking not found');
    }
    if (existing.status !== 'CHECKED_IN') {
      throw new ConflictException(
        'Only a checked-in booking can be transferred to another room',
      );
    }
    if (dto.toRoomId === existing.roomId) {
      throw new BadRequestException('The booking is already in that room');
    }

    return this.redisLock.withLock(`lock:room:${dto.toRoomId}`, () =>
      this.prisma.$transaction(async (tx) => {
        const toRoom = await tx.room.findUnique({
          where: { id: dto.toRoomId },
        });
        if (
          !toRoom ||
          !toRoom.isActive ||
          toRoom.branchId !== existing.branchId
        ) {
          throw new NotFoundException('Destination room not found');
        }
        if (toRoom.isOutOfOrder) {
          throw new ConflictException(
            'Destination room is currently out of order',
          );
        }
        if (toRoom.housekeepingStatus !== 'CLEAN') {
          throw new ConflictException(
            'Destination room has not been cleaned yet',
          );
        }

        const conflicts = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Booking"
          WHERE "roomId" = ${dto.toRoomId}
            AND "checkInDate" < ${existing.checkOutDate}
            AND "checkOutDate" > ${existing.checkInDate}
            AND (
              status = 'CONFIRMED'
              OR status = 'CHECKED_IN'
              OR (status = 'HELD' AND ("holdExpiresAt" IS NULL OR "holdExpiresAt" > now()))
            )
          FOR UPDATE
        `;
        if (conflicts.length > 0) {
          throw new ConflictException(
            'Destination room is not available for these dates',
          );
        }

        const fromRoomId = existing.roomId;

        const booking = await tx.booking.update({
          where: { id },
          data: { roomId: dto.toRoomId },
          include: BOOKING_INCLUDE,
        });

        await tx.roomTransfer.create({
          data: {
            branchId: existing.branchId,
            bookingId: id,
            fromRoomId,
            toRoomId: dto.toRoomId,
            reason: dto.reason,
            transferredByStaffId: actor.staffId,
          },
        });

        // Vacated room needs cleaning; the destination's occupancy is derived
        // from the booking itself, so it needs no housekeeping change.
        await tx.room.update({
          where: { id: fromRoomId },
          data: { housekeepingStatus: 'DIRTY' },
        });

        await this.audit.record(tx, {
          staffId: actor.staffId,
          branchId: booking.branchId,
          action: 'booking.transfer',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: { fromRoomId, toRoomId: dto.toRoomId, reason: dto.reason },
        });

        return toBookingDto(booking);
      }),
    );
  }

  private async searchAvailableRooms(
    scoped: boolean,
    query: RoomAvailabilityQueryDto,
  ): Promise<AvailableRoomDto[]> {
    const checkIn = parseDateOnly(query.checkInDate, 'checkInDate');
    const checkOut = parseDateOnly(query.checkOutDate, 'checkOutDate');
    assertValidStayRange(checkIn, checkOut);

    const where: Prisma.RoomWhereInput = {
      branchId: query.branchId,
      isActive: true,
      isOutOfOrder: false,
      housekeepingStatus: 'CLEAN',
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      bookings: {
        none: {
          ...dateRangeOverlapWhere(checkIn, checkOut),
          ...activeBookingStatusWhere(new Date()),
        },
      },
    };
    const findManyArgs = {
      where,
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    } as const;
    // Two explicit branches, not a ternary-selected client, so each call
    // site stays monomorphic — a union of scopedPrisma/prisma's extended
    // client types otherwise blows past TS's structural comparison depth
    // once the branch-scope extension covers enough models (Milestone 6).
    const rooms = scoped
      ? await this.scopedPrisma.room.findMany(findManyArgs)
      : await this.prisma.room.findMany(findManyArgs);

    return rooms.map((room) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: {
        id: room.roomType.id,
        name: room.roomType.name,
        maxOccupancy: room.roomType.maxOccupancy,
      },
    }));
  }

  /**
   * The one place double-booking is actually prevented (TRD §6). A Redis
   * lock on the room serializes concurrent attempts before they reach the
   * database; the row-locked overlap check inside the transaction is the
   * authoritative backstop even if the lock were ever bypassed or expired
   * early (see the Booking model's doc comment in schema.prisma).
   */
  private async createCore(params: CreateCoreParams): Promise<BookingDto> {
    const checkIn = parseDateOnly(params.checkInDate, 'checkInDate');
    const checkOut = parseDateOnly(params.checkOutDate, 'checkOutDate');
    assertValidStayRange(checkIn, checkOut);

    return this.redisLock.withLock(`lock:room:${params.roomId}`, () =>
      this.prisma.$transaction(async (tx) => {
        const room = await tx.room.findUnique({ where: { id: params.roomId } });
        if (!room || !room.isActive) {
          throw new NotFoundException('Room not found');
        }
        // Same 404 as "doesn't exist" — never confirm to an unauthorized
        // caller that a room exists in a branch they can't see.
        if (
          params.expectedBranchId &&
          room.branchId !== params.expectedBranchId
        ) {
          throw new NotFoundException('Room not found');
        }
        if (room.isOutOfOrder) {
          throw new ConflictException('This room is currently out of order');
        }

        const ratePlan = await tx.ratePlan.findUnique({
          where: { id: params.ratePlanId },
        });
        if (
          !ratePlan ||
          !ratePlan.isActive ||
          ratePlan.roomTypeId !== room.roomTypeId
        ) {
          throw new BadRequestException(
            'This rate plan does not apply to the selected room',
          );
        }

        const conflicts = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Booking"
          WHERE "roomId" = ${room.id}
            AND "checkInDate" < ${checkOut}
            AND "checkOutDate" > ${checkIn}
            AND (
              status = 'CONFIRMED'
              OR status = 'CHECKED_IN'
              OR (status = 'HELD' AND ("holdExpiresAt" IS NULL OR "holdExpiresAt" > now()))
            )
          FOR UPDATE
        `;
        if (conflicts.length > 0) {
          throw new ConflictException(
            'This room is no longer available for the selected dates',
          );
        }

        const guestId = await this.resolveGuestId(
          tx,
          params.guestId,
          params.guestInput,
        );

        const nights = nightsBetween(checkIn, checkOut);
        const totalAmount = new Prisma.Decimal(ratePlan.pricePerNight).mul(
          nights,
        );
        const holdMinutes =
          this.configService.get<number>('BOOKING_HOLD_MINUTES') ?? 15;

        const booking = await tx.booking.create({
          data: {
            branchId: room.branchId,
            roomId: room.id,
            ratePlanId: ratePlan.id,
            guestId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            status: 'HELD',
            holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000),
            totalAmount,
            source: params.source,
            createdByStaffId: params.createdByStaffId,
            notes: params.notes,
          },
          include: BOOKING_INCLUDE,
        });

        await this.audit.record(tx, {
          staffId: params.createdByStaffId ?? null,
          branchId: room.branchId,
          action: 'booking.create',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: { source: params.source },
        });

        return toBookingDto(booking);
      }),
    );
  }

  private async resolveGuestId(
    tx: Prisma.TransactionClient,
    guestId: string | undefined,
    guestInput: GuestInputDto | undefined,
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
}
