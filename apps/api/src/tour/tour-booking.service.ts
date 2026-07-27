import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BookingSource,
  GuestInput,
  InitiatePaymentResponse,
  InvoiceDto,
  PaginatedResponse,
  TourBookingDto,
} from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto } from '../billing/dto/create-payment.dto';
import { INVOICE_INCLUDE, toInvoiceDto } from '../billing/invoice.mapper';
import { PaymentService } from '../billing/payment.service';
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
import { sumActiveSeatsByDeparture } from './tour-departure.service';
import {
  TOUR_BOOKING_INCLUDE,
  toTourBookingDto,
  type TourBookingWithRelations,
} from './tour-booking.mapper';
import { CancelTourBookingDto } from './dto/cancel-tour-booking.dto';
import { CreatePublicTourBookingDto } from './dto/create-public-tour-booking.dto';
import { CreateTourBookingDto } from './dto/create-tour-booking.dto';
import { ListTourBookingsQueryDto } from './dto/list-tour-bookings-query.dto';
import { resolveGuestId } from './tour.util';

interface CreateCoreParams {
  /** Non-Super-Admin staff and every public request must match this; Super
   * Admin omits it and the departure's own branch is trusted instead. */
  expectedBranchId?: string;
  tourDepartureId: string;
  seats: number;
  guestId?: string;
  guestInput?: GuestInput;
  linkedBookingId?: string;
  notes?: string;
  source: BookingSource;
  createdByStaffId?: string;
}

@Injectable()
export class TourBookingService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly redisLock: RedisLockService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
    private readonly paymentService: PaymentService,
  ) {}

  async list(
    query: ListTourBookingsQueryDto,
  ): Promise<PaginatedResponse<TourBookingDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.TourBookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.tourDepartureId
        ? { tourDepartureId: query.tourDepartureId }
        : {}),
    };

    const [bookings, total] = await Promise.all([
      this.scopedPrisma.tourBooking.findMany({
        where,
        skip,
        take,
        include: TOUR_BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.scopedPrisma.tourBooking.count({ where }),
    ]);
    const dtos = await this.toDtos(this.prisma, bookings);
    return buildPaginatedResponse(dtos, total, page, pageSize);
  }

  async findOneOrThrow(id: string): Promise<TourBookingDto> {
    const booking = await this.scopedPrisma.tourBooking.findUnique({
      where: { id },
      include: TOUR_BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException('Tour booking not found');
    }
    const [dto] = await this.toDtos(this.prisma, [booking]);
    return dto;
  }

  createForStaff(
    dto: CreateTourBookingDto,
    actor: ActorContext,
  ): Promise<TourBookingDto> {
    return this.createCore({
      expectedBranchId:
        actor.role === 'SUPER_ADMIN' ? undefined : actor.branchId,
      tourDepartureId: dto.tourDepartureId,
      seats: dto.seats,
      guestId: dto.guestId,
      guestInput: dto.guest,
      linkedBookingId: dto.linkedBookingId,
      notes: dto.notes,
      source: 'STAFF_MANUAL',
      createdByStaffId: actor.staffId,
    });
  }

  createForGuest(dto: CreatePublicTourBookingDto): Promise<TourBookingDto> {
    return this.createCore({
      expectedBranchId: dto.branchId,
      tourDepartureId: dto.tourDepartureId,
      seats: dto.seats,
      guestInput: dto.guest,
      linkedBookingId: dto.linkedBookingId,
      source: 'GUEST_ONLINE',
    });
  }

  async confirm(id: string, actor: ActorContext): Promise<TourBookingDto> {
    const existing = await this.scopedPrisma.tourBooking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Tour booking not found');
    }
    if (existing.status !== 'HELD') {
      throw new ConflictException(
        `Cannot confirm a tour booking with status ${existing.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.tourBooking.update({
        where: { id },
        data: { status: 'CONFIRMED', holdExpiresAt: null },
        include: TOUR_BOOKING_INCLUDE,
      });

      // Bundled with a room stay: land the charge directly on that
      // booking's folio (same table Milestone 5's FolioService reads/writes)
      // rather than calling FolioService.addCharge from inside this
      // transaction — that method owns its own transaction boundary, and
      // nesting it here would split one logical operation across two
      // commits. Mirrors booking.service.ts's checkIn writing directly to
      // ShiftTransaction instead of going through ShiftService.
      if (booking.linkedBookingId) {
        const linkedBooking = await tx.booking.findUnique({
          where: { id: booking.linkedBookingId },
        });
        if (
          !linkedBooking ||
          linkedBooking.status === 'HELD' ||
          linkedBooking.status === 'CANCELLED' ||
          linkedBooking.status === 'EXPIRED'
        ) {
          throw new ConflictException(
            'The linked room booking is no longer able to accept folio charges',
          );
        }
        await tx.folioCharge.create({
          data: {
            branchId: booking.branchId,
            bookingId: booking.linkedBookingId,
            category: 'TOUR',
            description: `${booking.tourDeparture.tourPackage.name} — ${booking.seats} seat(s)`,
            amount: booking.totalAmount,
            createdByStaffId: actor.staffId,
          },
        });
      }

      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: booking.branchId,
        action: 'tour-booking.confirm',
        entityType: 'TourBooking',
        entityId: booking.id,
      });

      const [dtoResult] = await this.toDtos(tx, [booking]);
      return dtoResult;
    });
  }

  async cancel(
    id: string,
    dto: CancelTourBookingDto,
    actor: ActorContext,
  ): Promise<TourBookingDto> {
    const existing = await this.scopedPrisma.tourBooking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Tour booking not found');
    }
    if (existing.status !== 'HELD' && existing.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Cannot cancel a tour booking with status ${existing.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.tourBooking.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: TOUR_BOOKING_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: booking.branchId,
        action: 'tour-booking.cancel',
        entityType: 'TourBooking',
        entityId: booking.id,
        metadata: dto.reason ? { reason: dto.reason } : undefined,
      });
      const [dtoResult] = await this.toDtos(tx, [booking]);
      return dtoResult;
    });
  }

  /**
   * Recording a payment against a standalone tour booking's invoice — kept
   * on this controller/service (RBAC: SUPER_ADMIN/TOURS_COORDINATOR) rather
   * than exposed via the shared `/invoices/:id/payments` route, whose roles
   * are scoped to hotel-billing staff (Front Desk/Branch Manager) per the
   * PRD's Tours & Packages RACI — a Tours Coordinator should be able to pay
   * off invoices for tour bookings they manage without being granted access
   * to every other invoice in the branch.
   */
  async recordPayment(
    id: string,
    dto: CreatePaymentDto,
    actor: ActorContext,
  ): Promise<InitiatePaymentResponse> {
    const invoice = await this.scopedPrisma.invoice.findFirst({
      where: { tourBookingId: id, status: 'ISSUED' },
    });
    if (!invoice) {
      throw new NotFoundException(
        'No issued invoice found for this tour booking',
      );
    }
    return this.paymentService.createPayment(invoice.id, dto, actor);
  }

  /** The most recent invoice issued for this tour booking, if any — lets the
   * frontend refresh payment status after recording a payment without a
   * separate round-trip through the shared /invoices endpoints. */
  async findLatestInvoice(id: string): Promise<InvoiceDto | null> {
    const invoice = await this.scopedPrisma.invoice.findFirst({
      where: { tourBookingId: id },
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
    return invoice ? toInvoiceDto(invoice) : null;
  }

  /**
   * Seat-availability double-booking prevention — the same two-layer
   * defense as room booking (booking.service.ts's createCore): a Redis lock
   * on the departure serializes concurrent seat requests before they reach
   * the database, and a row-locked read of currently-active bookings inside
   * one Postgres transaction is the authoritative backstop.
   */
  private async createCore(params: CreateCoreParams): Promise<TourBookingDto> {
    return this.redisLock.withLock(
      `lock:tour-departure:${params.tourDepartureId}`,
      () =>
        this.prisma.$transaction(async (tx) => {
          const departure = await tx.tourDeparture.findUnique({
            where: { id: params.tourDepartureId },
          });
          if (!departure) {
            throw new NotFoundException('Tour departure not found');
          }
          // Same 404 as "doesn't exist" — never confirm to an unauthorized
          // caller that a departure exists in a branch they can't see.
          if (
            params.expectedBranchId &&
            departure.branchId !== params.expectedBranchId
          ) {
            throw new NotFoundException('Tour departure not found');
          }
          if (departure.status !== 'SCHEDULED') {
            throw new ConflictException(
              'This departure is no longer open for booking',
            );
          }
          if (departure.departureAt <= new Date()) {
            throw new ConflictException('This departure has already left');
          }

          const activeRows = await tx.$queryRaw<Array<{ seats: number }>>`
            SELECT seats FROM "TourBooking"
            WHERE "tourDepartureId" = ${departure.id}
              AND (
                status = 'CONFIRMED'
                OR (status = 'HELD' AND ("holdExpiresAt" IS NULL OR "holdExpiresAt" > now()))
              )
            FOR UPDATE
          `;
          const bookedSeats = activeRows.reduce((sum, r) => sum + r.seats, 0);
          if (departure.totalSeats - bookedSeats < params.seats) {
            throw new ConflictException(
              'Not enough seats available for this departure',
            );
          }

          let linkedBookingId: string | undefined;
          if (params.linkedBookingId) {
            const linkedBooking = await tx.booking.findUnique({
              where: { id: params.linkedBookingId },
            });
            if (
              !linkedBooking ||
              linkedBooking.branchId !== departure.branchId
            ) {
              throw new NotFoundException('Linked room booking not found');
            }
            if (
              linkedBooking.status === 'CANCELLED' ||
              linkedBooking.status === 'EXPIRED'
            ) {
              throw new BadRequestException(
                'Cannot bundle a tour with a cancelled or expired room booking',
              );
            }
            linkedBookingId = linkedBooking.id;
          }

          const guestId = await resolveGuestId(
            tx,
            params.guestId,
            params.guestInput,
          );

          const totalAmount = new Prisma.Decimal(departure.pricePerSeat).mul(
            params.seats,
          );
          const holdMinutes =
            this.configService.get<number>('BOOKING_HOLD_MINUTES') ?? 15;

          const booking = await tx.tourBooking.create({
            data: {
              branchId: departure.branchId,
              tourDepartureId: departure.id,
              guestId,
              seats: params.seats,
              status: 'HELD',
              holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000),
              totalAmount,
              source: params.source,
              createdByStaffId: params.createdByStaffId,
              linkedBookingId,
              notes: params.notes,
            },
            include: TOUR_BOOKING_INCLUDE,
          });

          await this.audit.record(tx, {
            staffId: params.createdByStaffId ?? null,
            branchId: departure.branchId,
            action: 'tour-booking.create',
            entityType: 'TourBooking',
            entityId: booking.id,
            metadata: { source: params.source, seats: params.seats },
          });

          const [dtoResult] = await this.toDtos(tx, [booking]);
          return dtoResult;
        }),
    );
  }

  private async toDtos(
    client: Prisma.TransactionClient,
    bookings: TourBookingWithRelations[],
  ): Promise<TourBookingDto[]> {
    const now = new Date();
    const departureIds = [...new Set(bookings.map((b) => b.tourDepartureId))];
    const bookedByDeparture = await sumActiveSeatsByDeparture(
      client,
      departureIds,
      now,
    );
    return bookings.map((booking) => {
      const totalSeats = booking.tourDeparture.totalSeats;
      const booked = bookedByDeparture.get(booking.tourDepartureId) ?? 0;
      return toTourBookingDto(booking, totalSeats - booked);
    });
  }
}
