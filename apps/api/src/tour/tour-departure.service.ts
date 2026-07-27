import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  PaginatedResponse,
  TourDepartureDto,
  TourManifestDto,
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
import { CreateTourDepartureDto } from './dto/create-tour-departure.dto';
import { ListTourDeparturesQueryDto } from './dto/list-tour-departures-query.dto';
import {
  TOUR_DEPARTURE_INCLUDE,
  toTourDepartureDto,
  type TourDepartureWithRelations,
} from './tour-departure.mapper';
import {
  activeTourBookingStatusWhere,
  assertValidDepartureRange,
  parseDepartureDate,
} from './tour.util';

/** Sums each departure's currently-active booked seats in one query — the
 * batched form of the "totalSeats - sum(active bookings' seats)" computation
 * used both for list/detail reads and, under a transaction, as the
 * authoritative seat-availability check when a booking is created. */
export async function sumActiveSeatsByDeparture(
  client: Prisma.TransactionClient,
  departureIds: string[],
  now: Date,
): Promise<Map<string, number>> {
  if (departureIds.length === 0) {
    return new Map();
  }
  const rows = await client.tourBooking.groupBy({
    by: ['tourDepartureId'],
    where: {
      tourDepartureId: { in: departureIds },
      ...activeTourBookingStatusWhere(now),
    },
    _sum: { seats: true },
  });
  return new Map(rows.map((r) => [r.tourDepartureId, r._sum.seats ?? 0]));
}

@Injectable()
export class TourDepartureService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly redisLock: RedisLockService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListTourDeparturesQueryDto,
  ): Promise<PaginatedResponse<TourDepartureDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.TourDepartureWhereInput = {
      ...(query.tourPackageId ? { tourPackageId: query.tourPackageId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.departureFrom || query.departureTo
        ? {
            departureAt: {
              ...(query.departureFrom
                ? {
                    gte: parseDepartureDate(
                      query.departureFrom,
                      'departureFrom',
                    ),
                  }
                : {}),
              ...(query.departureTo
                ? { lte: parseDepartureDate(query.departureTo, 'departureTo') }
                : {}),
            },
          }
        : {}),
    };

    const [departures, total] = await Promise.all([
      this.scopedPrisma.tourDeparture.findMany({
        where,
        skip,
        take,
        include: TOUR_DEPARTURE_INCLUDE,
        orderBy: { departureAt: 'asc' },
      }),
      this.scopedPrisma.tourDeparture.count({ where }),
    ]);

    const dtos = await this.toDtos(this.prisma, departures);
    return buildPaginatedResponse(dtos, total, page, pageSize);
  }

  /** Unauthenticated guest browsing of upcoming departures for a package —
   * no actor context to scope by, so branch membership is derived from the
   * package itself rather than trusted from the caller. */
  async listPublicUpcomingByPackage(
    tourPackageId: string,
  ): Promise<TourDepartureDto[]> {
    const tourPackage = await this.prisma.tourPackage.findUnique({
      where: { id: tourPackageId },
    });
    if (!tourPackage || !tourPackage.isActive) {
      throw new NotFoundException('Tour package not found');
    }
    const departures = await this.prisma.tourDeparture.findMany({
      where: {
        tourPackageId,
        status: 'SCHEDULED',
        departureAt: { gt: new Date() },
      },
      include: TOUR_DEPARTURE_INCLUDE,
      orderBy: { departureAt: 'asc' },
    });
    return this.toDtos(this.prisma, departures);
  }

  async findOneOrThrow(id: string): Promise<TourDepartureDto> {
    const departure = await this.scopedPrisma.tourDeparture.findUnique({
      where: { id },
      include: TOUR_DEPARTURE_INCLUDE,
    });
    if (!departure) {
      throw new NotFoundException('Tour departure not found');
    }
    const [dto] = await this.toDtos(this.prisma, [departure]);
    return dto;
  }

  /**
   * Guide/vehicle double-booking prevention (TRD: "applies to tour_departures
   * and guides/vehicles as in v1.0") — the same two-layer defense as
   * booking.service.ts's room overlap check: a Redis lock on both the guide
   * and the vehicle serializes concurrent scheduling attempts, and a
   * row-locked overlap query inside one Postgres transaction is the
   * authoritative backstop even if the lock were ever bypassed or expired
   * early.
   */
  async create(
    dto: CreateTourDepartureDto,
    actor: ActorContext,
  ): Promise<TourDepartureDto> {
    const departureAt = parseDepartureDate(dto.departureAt, 'departureAt');
    const returnAt = parseDepartureDate(dto.returnAt, 'returnAt');
    assertValidDepartureRange(departureAt, returnAt);

    return this.redisLock.withLock(`lock:tour-guide:${dto.guideId}`, () =>
      this.redisLock.withLock(`lock:vehicle:${dto.vehicleId}`, () =>
        this.prisma.$transaction(async (tx) => {
          const tourPackage = await tx.tourPackage.findUnique({
            where: { id: dto.tourPackageId },
          });
          if (!tourPackage || !tourPackage.isActive) {
            throw new NotFoundException('Tour package not found');
          }
          const guide = await tx.tourGuide.findUnique({
            where: { id: dto.guideId },
          });
          if (
            !guide ||
            !guide.isActive ||
            guide.branchId !== tourPackage.branchId
          ) {
            throw new NotFoundException('Tour guide not found');
          }
          const vehicle = await tx.vehicle.findUnique({
            where: { id: dto.vehicleId },
          });
          if (
            !vehicle ||
            !vehicle.isActive ||
            vehicle.branchId !== tourPackage.branchId
          ) {
            throw new NotFoundException('Vehicle not found');
          }

          const conflicts = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "TourDeparture"
            WHERE ("guideId" = ${dto.guideId} OR "vehicleId" = ${dto.vehicleId})
              AND status = 'SCHEDULED'
              AND "departureAt" < ${returnAt}
              AND "returnAt" > ${departureAt}
            FOR UPDATE
          `;
          if (conflicts.length > 0) {
            throw new ConflictException(
              'The selected guide or vehicle is already scheduled for an overlapping departure',
            );
          }

          const departure = await tx.tourDeparture.create({
            data: {
              branchId: tourPackage.branchId,
              tourPackageId: tourPackage.id,
              guideId: guide.id,
              vehicleId: vehicle.id,
              departureAt,
              returnAt,
              totalSeats: dto.totalSeats ?? tourPackage.defaultCapacity,
              pricePerSeat:
                dto.pricePerSeat ?? tourPackage.defaultPricePerSeat,
              notes: dto.notes,
              createdByStaffId: actor.staffId,
            },
            include: TOUR_DEPARTURE_INCLUDE,
          });

          await this.audit.record(tx, {
            staffId: actor.staffId,
            branchId: departure.branchId,
            action: 'tour-departure.create',
            entityType: 'TourDeparture',
            entityId: departure.id,
          });

          const [result] = await this.toDtos(tx, [departure]);
          return result;
        }),
      ),
    );
  }

  /**
   * Cancelling a departure cascade-cancels its active bookings in the same
   * transaction — leaving them HELD/CONFIRMED against a CANCELLED departure
   * would be an inconsistent state, the same principle as checkOut
   * auto-dirtying the vacated room rather than leaving mismatched state.
   */
  async cancel(id: string, actor: ActorContext): Promise<TourDepartureDto> {
    const existing = await this.scopedPrisma.tourDeparture.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Tour departure not found');
    }
    if (existing.status !== 'SCHEDULED') {
      throw new ConflictException(
        `Cannot cancel a departure with status ${existing.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const departure = await tx.tourDeparture.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: TOUR_DEPARTURE_INCLUDE,
      });
      await tx.tourBooking.updateMany({
        where: {
          tourDepartureId: id,
          ...activeTourBookingStatusWhere(new Date()),
        },
        data: { status: 'CANCELLED' },
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: departure.branchId,
        action: 'tour-departure.cancel',
        entityType: 'TourDeparture',
        entityId: departure.id,
      });
      const [result] = await this.toDtos(tx, [departure]);
      return result;
    });
  }

  /** PRD §5.8's manifest view — the guest list for one departure. */
  async getManifest(id: string): Promise<TourManifestDto> {
    const departure = await this.scopedPrisma.tourDeparture.findUnique({
      where: { id },
      include: TOUR_DEPARTURE_INCLUDE,
    });
    if (!departure) {
      throw new NotFoundException('Tour departure not found');
    }

    const bookings = await this.scopedPrisma.tourBooking.findMany({
      where: {
        tourDepartureId: id,
        ...activeTourBookingStatusWhere(new Date()),
      },
      include: { guest: true },
      orderBy: { createdAt: 'asc' },
    });

    const [departureDto] = await this.toDtos(this.prisma, [departure]);
    return {
      tourDeparture: departureDto,
      entries: bookings.map((b) => ({
        tourBookingId: b.id,
        seats: b.seats,
        status: b.status,
        guest: {
          id: b.guest.id,
          firstName: b.guest.firstName,
          lastName: b.guest.lastName,
          email: b.guest.email,
          phone: b.guest.phone,
        },
        notes: b.notes,
      })),
      totalSeatsBooked: bookings.reduce((sum, b) => sum + b.seats, 0),
    };
  }

  private async toDtos(
    client: Prisma.TransactionClient,
    departures: TourDepartureWithRelations[],
  ): Promise<TourDepartureDto[]> {
    const now = new Date();
    const bookedByDeparture = await sumActiveSeatsByDeparture(
      client,
      departures.map((d) => d.id),
      now,
    );
    return departures.map((departure) =>
      toTourDepartureDto(
        departure,
        departure.totalSeats - (bookedByDeparture.get(departure.id) ?? 0),
      ),
    );
  }
}
