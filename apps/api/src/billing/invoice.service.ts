import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InvoiceDto } from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import type { InvoicePdfBookingSummary } from './invoice-pdf.service';
import { FolioService } from './folio.service';
import { INVOICE_INCLUDE, toInvoiceDto } from './invoice.mapper';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly folioService: FolioService,
  ) {}

  async list(): Promise<InvoiceDto[]> {
    const invoices = await this.scopedPrisma.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
    return invoices.map(toInvoiceDto);
  }

  async findOneOrThrow(id: string): Promise<InvoiceDto> {
    const invoice = await this.scopedPrisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return toInvoiceDto(invoice);
  }

  /**
   * One active invoice per booking at a time (not one ever, and not many
   * simultaneously) — good enough for Phase 1 without a credit-note system.
   * Adding charges after issuing means voiding (only while unpaid) and
   * reissuing, which naturally picks up the new folio total.
   */
  async issueInvoice(
    bookingId: string,
    actor: ActorContext,
  ): Promise<InvoiceDto> {
    const booking = await this.scopedPrisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const existingActive = await this.scopedPrisma.invoice.findFirst({
      where: { bookingId, status: 'ISSUED' },
    });
    if (existingActive) {
      throw new ConflictException(
        'An invoice already exists for this booking; void it first to reissue',
      );
    }

    const folio = await this.folioService.getFolio(bookingId);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          branchId: booking.branchId,
          bookingId,
          guestId: booking.guestId,
          totalAmount: folio.totalCharges,
          createdByStaffId: actor.staffId,
        },
        include: INVOICE_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: booking.branchId,
        action: 'invoice.issue',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { totalAmount: folio.totalCharges },
      });
      return toInvoiceDto(invoice);
    });
  }

  /**
   * Milestone 6: billing for a standalone tour booking (no linked room
   * stay — a bundled one is charged onto the room's folio instead, see
   * TourBookingService.confirm). No FolioService involved here: a tour
   * booking has no folio/incidentals concept, so its invoice total is
   * simply the booking's own totalAmount.
   */
  async issueInvoiceForTourBooking(
    tourBookingId: string,
    actor: ActorContext,
  ): Promise<InvoiceDto> {
    const tourBooking = await this.scopedPrisma.tourBooking.findUnique({
      where: { id: tourBookingId },
    });
    if (!tourBooking) {
      throw new NotFoundException('Tour booking not found');
    }
    if (tourBooking.linkedBookingId) {
      throw new BadRequestException(
        "A tour bundled with a room stay is invoiced via that booking's folio, not its own invoice",
      );
    }
    if (tourBooking.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Cannot invoice a tour booking with status ${tourBooking.status}`,
      );
    }

    const existingActive = await this.scopedPrisma.invoice.findFirst({
      where: { tourBookingId, status: 'ISSUED' },
    });
    if (existingActive) {
      throw new ConflictException(
        'An invoice already exists for this tour booking; void it first to reissue',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          branchId: tourBooking.branchId,
          tourBookingId,
          guestId: tourBooking.guestId,
          totalAmount: tourBooking.totalAmount,
          createdByStaffId: actor.staffId,
        },
        include: INVOICE_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: tourBooking.branchId,
        action: 'invoice.issue.tour-booking',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { totalAmount: tourBooking.totalAmount.toString() },
      });
      return toInvoiceDto(invoice);
    });
  }

  /**
   * Milestone 7: billing for a standalone restaurant order (dine-in or
   * takeaway — a room-service order rides the linked booking's folio
   * instead, see RestaurantOrderService.bill). No folio concept for a bare
   * order, same reasoning as issueInvoiceForTourBooking: the total is just
   * the sum of the order's own line items.
   */
  async issueInvoiceForRestaurantOrder(
    restaurantOrderId: string,
    actor: ActorContext,
  ): Promise<InvoiceDto> {
    const order = await this.scopedPrisma.restaurantOrder.findUnique({
      where: { id: restaurantOrderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Restaurant order not found');
    }
    if (order.roomBookingId) {
      throw new BadRequestException(
        'A room-service order is billed to the room folio, not its own invoice',
      );
    }
    if (order.status !== 'SERVED') {
      throw new ConflictException(
        `Cannot invoice a restaurant order with status ${order.status}`,
      );
    }

    const existingActive = await this.scopedPrisma.invoice.findFirst({
      where: { restaurantOrderId, status: 'ISSUED' },
    });
    if (existingActive) {
      throw new ConflictException(
        'An invoice already exists for this restaurant order; void it first to reissue',
      );
    }

    const totalAmount = order.items.reduce(
      (sum, item) => sum.add(item.unitPriceAtOrder.mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          branchId: order.branchId,
          restaurantOrderId,
          guestId: order.guestId,
          totalAmount,
          createdByStaffId: actor.staffId,
        },
        include: INVOICE_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: order.branchId,
        action: 'invoice.issue.restaurant-order',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { totalAmount: totalAmount.toString() },
      });
      return toInvoiceDto(invoice);
    });
  }

  async voidInvoice(id: string, actor: ActorContext): Promise<InvoiceDto> {
    const invoice = await this.scopedPrisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === 'VOID') {
      throw new ConflictException('This invoice is already void');
    }
    const hasMoneyAgainstIt = invoice.payments.some(
      (p) => p.status !== 'FAILED',
    );
    if (hasMoneyAgainstIt) {
      throw new ConflictException(
        'Cannot void an invoice that has payments recorded against it',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'VOID', voidedAt: new Date() },
        include: INVOICE_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: invoice.branchId,
        action: 'invoice.void',
        entityType: 'Invoice',
        entityId: invoice.id,
      });
      return toInvoiceDto(updated);
    });
  }

  /** Everything invoice-pdf.service.ts needs to render the PDF, gathered in
   * one place so the controller doesn't touch Prisma directly. */
  async getPdfContext(id: string): Promise<{
    branchName: string;
    booking: InvoicePdfBookingSummary;
  }> {
    const invoice = await this.scopedPrisma.invoice.findUnique({
      where: { id },
      include: {
        branch: true,
        booking: { include: { room: true, guest: true } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (!invoice.booking) {
      // Callers must check invoice.bookingId before reaching here — see
      // InvoiceController.pdf's guard for standalone tour-booking invoices.
      throw new BadRequestException(
        'This invoice has no linked room booking to render a PDF from',
      );
    }
    return {
      branchName: invoice.branch.name,
      booking: {
        roomNumber: invoice.booking.room.roomNumber,
        checkInDate: invoice.booking.checkInDate.toISOString(),
        checkOutDate: invoice.booking.checkOutDate.toISOString(),
        guestName: `${invoice.booking.guest.firstName} ${invoice.booking.guest.lastName}`,
      },
    };
  }
}
