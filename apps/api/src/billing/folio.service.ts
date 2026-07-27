import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FolioDto } from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { computeFolioTotals, computeInvoiceAmountPaid } from './billing.util';
import { CreateFolioChargeDto } from './dto/create-folio-charge.dto';
import { FOLIO_CHARGE_INCLUDE, toFolioChargeDto } from './folio.mapper';
import { INVOICE_INCLUDE, toInvoiceDto } from './invoice.mapper';

@Injectable()
export class FolioService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * PRD §5.7's unified guest folio — computed live on every read, the same
   * "computed, not stored" choice made for the Milestone 3 room-status
   * board, for the same reason: it can't drift from the booking/charges/
   * payments rows that are the actual source of truth.
   */
  async getFolio(bookingId: string): Promise<FolioDto> {
    const booking = await this.scopedPrisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const charges = await this.scopedPrisma.folioCharge.findMany({
      where: { bookingId },
      include: FOLIO_CHARGE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    const invoices = await this.scopedPrisma.invoice.findMany({
      where: { bookingId, status: { not: 'VOID' } },
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'asc' },
    });

    const totalPaid = invoices.reduce(
      (sum, invoice) => sum.add(computeInvoiceAmountPaid(invoice.payments)),
      new Prisma.Decimal(0),
    );
    const totals = computeFolioTotals(booking.totalAmount, charges, totalPaid);

    return {
      bookingId: booking.id,
      roomCharge: booking.totalAmount.toString(),
      earlyCheckInFee: booking.earlyCheckInFee
        ? booking.earlyCheckInFee.toString()
        : null,
      lateCheckOutFee: booking.lateCheckOutFee
        ? booking.lateCheckOutFee.toString()
        : null,
      charges: charges.map(toFolioChargeDto),
      invoices: invoices.map(toInvoiceDto),
      totalCharges: totals.totalCharges.toString(),
      totalPaid: totals.totalPaid.toString(),
      balanceDue: totals.balanceDue.toString(),
    };
  }

  async addCharge(
    bookingId: string,
    dto: CreateFolioChargeDto,
    actor: ActorContext,
  ) {
    const booking = await this.scopedPrisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (
      booking.status === 'HELD' ||
      booking.status === 'CANCELLED' ||
      booking.status === 'EXPIRED'
    ) {
      throw new BadRequestException(
        `Cannot add a folio charge to a booking with status ${booking.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const charge = await tx.folioCharge.create({
        data: {
          branchId: booking.branchId,
          bookingId,
          category: dto.category ?? 'INCIDENTAL',
          description: dto.description,
          amount: dto.amount,
          createdByStaffId: actor.staffId,
        },
        include: FOLIO_CHARGE_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: booking.branchId,
        action: 'folio.charge.create',
        entityType: 'Booking',
        entityId: bookingId,
        metadata: { amount: dto.amount, description: dto.description },
      });
      return toFolioChargeDto(charge);
    });
  }
}
