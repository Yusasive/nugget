import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResponse, ShiftDto } from '@nugget/shared-types';
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
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateShiftTransactionDto } from './dto/create-shift-transaction.dto';
import { ListCashReportsQueryDto } from './dto/list-cash-reports-query.dto';
import { ListShiftsQueryDto } from './dto/list-shifts-query.dto';
import { OpenShiftDto } from './dto/open-shift.dto';
import { SHIFT_INCLUDE, toShiftDto } from './shift.mapper';
import { computeCashReconciliation } from './shift.util';

@Injectable()
export class ShiftService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListShiftsQueryDto,
    actor: ActorContext,
  ): Promise<PaginatedResponse<ShiftDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.ShiftWhereInput = {
      // Front Desk is always forced to their own shifts regardless of what
      // (if anything) they passed as staffId — this is the same
      // stricter-than-branch rule enforced in findAccessibleShiftOrThrow.
      staffId: actor.role === 'FRONT_DESK' ? actor.staffId : query.staffId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.openedFrom || query.openedTo
        ? {
            openedAt: {
              ...(query.openedFrom ? { gte: new Date(query.openedFrom) } : {}),
              ...(query.openedTo ? { lte: new Date(query.openedTo) } : {}),
            },
          }
        : {}),
    };

    const [shifts, total] = await Promise.all([
      this.scopedPrisma.shift.findMany({
        where,
        skip,
        take,
        include: SHIFT_INCLUDE,
        orderBy: { openedAt: 'desc' },
      }),
      this.scopedPrisma.shift.count({ where }),
    ]);
    return buildPaginatedResponse(
      shifts.map(toShiftDto),
      total,
      page,
      pageSize,
    );
  }

  /**
   * PRD §5.4 / TRD §5: only Accountant, Branch Manager, and Super Admin see
   * cash reports across staff — a Front Desk staff member's own shifts are
   * visible via list()/findOneOrThrow(), but never someone else's cash
   * report. Enforced again here (not just by the @Roles guard) since it's a
   * stricter-than-branch rule the generic scoping extension doesn't know
   * about.
   */
  async listCashReports(
    query: ListCashReportsQueryDto,
  ): Promise<PaginatedResponse<ShiftDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.ShiftWhereInput = {
      status: 'CLOSED',
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.closedFrom || query.closedTo
        ? {
            closedAt: {
              ...(query.closedFrom ? { gte: new Date(query.closedFrom) } : {}),
              ...(query.closedTo ? { lte: new Date(query.closedTo) } : {}),
            },
          }
        : {}),
    };

    const [shifts, total] = await Promise.all([
      this.scopedPrisma.shift.findMany({
        where,
        skip,
        take,
        include: SHIFT_INCLUDE,
        orderBy: { closedAt: 'desc' },
      }),
      this.scopedPrisma.shift.count({ where }),
    ]);
    return buildPaginatedResponse(
      shifts.map(toShiftDto),
      total,
      page,
      pageSize,
    );
  }

  /**
   * Throws 404 rather than returning null for "no open shift" — a bare
   * `null` return is indistinguishable from `undefined` to Nest's response
   * handling and gets sent as an empty body, which breaks JSON-parsing
   * clients. 404 is also the semantically correct status for "this
   * resource (your current shift) doesn't exist right now".
   */
  async findMyOpenShift(actor: ActorContext): Promise<ShiftDto> {
    const shift = await this.scopedPrisma.shift.findFirst({
      where: { staffId: actor.staffId, status: 'OPEN' },
      include: SHIFT_INCLUDE,
    });
    if (!shift) {
      throw new NotFoundException('No open shift');
    }
    return toShiftDto(shift);
  }

  async findOneOrThrow(id: string, actor: ActorContext): Promise<ShiftDto> {
    const shift = await this.scopedPrisma.shift.findUnique({
      where: { id },
      include: SHIFT_INCLUDE,
    });
    if (
      !shift ||
      (actor.role === 'FRONT_DESK' && shift.staffId !== actor.staffId)
    ) {
      throw new NotFoundException('Shift not found');
    }
    return toShiftDto(shift);
  }

  async openShift(dto: OpenShiftDto, actor: ActorContext): Promise<ShiftDto> {
    const existingOpen = await this.scopedPrisma.shift.findFirst({
      where: { staffId: actor.staffId, status: 'OPEN' },
    });
    if (existingOpen) {
      throw new ConflictException('You already have an open shift');
    }

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.create({
        data: {
          branchId: actor.branchId,
          staffId: actor.staffId,
          openingCash: dto.openingCash,
        },
        include: SHIFT_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: shift.branchId,
        action: 'shift.open',
        entityType: 'Shift',
        entityId: shift.id,
      });
      return toShiftDto(shift);
    });
  }

  /**
   * PRD §5.4's "daily sales entry": a cash movement attributed to an open
   * shift. Also called internally (with the actor who performed the
   * check-in) by BookingService.checkIn when a deposit is collected — see
   * that method for the automatic-attribution path.
   */
  async addTransaction(
    id: string,
    dto: CreateShiftTransactionDto,
    actor: ActorContext,
  ): Promise<ShiftDto> {
    const shift = await this.findAccessibleShiftOrThrow(id, actor);
    if (shift.status !== 'OPEN') {
      throw new ConflictException(
        'Cannot record a transaction against a closed shift',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.shiftTransaction.create({
        data: {
          branchId: shift.branchId,
          shiftId: shift.id,
          type: dto.type,
          amount: dto.amount,
          description: dto.description,
          bookingId: dto.bookingId,
          recordedByStaffId: actor.staffId,
        },
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: shift.branchId,
        action: 'shift.transaction.create',
        entityType: 'Shift',
        entityId: shift.id,
        metadata: { type: dto.type, amount: dto.amount },
      });
      const updated = await tx.shift.findUniqueOrThrow({
        where: { id: shift.id },
        include: SHIFT_INCLUDE,
      });
      return toShiftDto(updated);
    });
  }

  async closeShift(
    id: string,
    dto: CloseShiftDto,
    actor: ActorContext,
  ): Promise<ShiftDto> {
    const shift = await this.findAccessibleShiftOrThrow(id, actor);
    if (shift.status !== 'OPEN') {
      throw new ConflictException('This shift is already closed');
    }

    return this.prisma.$transaction(async (tx) => {
      const transactions = await tx.shiftTransaction.findMany({
        where: { shiftId: shift.id },
      });
      const reconciliation = computeCashReconciliation(
        shift.openingCash,
        transactions,
        new Prisma.Decimal(dto.closingCashActual),
      );

      await tx.shift.update({
        where: { id: shift.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closingCashExpected: reconciliation.closingCashExpected,
          closingCashActual: dto.closingCashActual,
          notes: dto.notes,
        },
      });

      await tx.cashReport.create({
        data: {
          branchId: shift.branchId,
          shiftId: shift.id,
          totalSales: reconciliation.totalSales,
          totalCashCollected: reconciliation.totalCashCollected,
          discrepancy: reconciliation.discrepancy,
          notes: dto.notes,
        },
      });

      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: shift.branchId,
        action: 'shift.close',
        entityType: 'Shift',
        entityId: shift.id,
        metadata: { discrepancy: reconciliation.discrepancy.toString() },
      });

      const updated = await tx.shift.findUniqueOrThrow({
        where: { id: shift.id },
        include: SHIFT_INCLUDE,
      });
      return toShiftDto(updated);
    });
  }

  private async findAccessibleShiftOrThrow(id: string, actor: ActorContext) {
    const shift = await this.scopedPrisma.shift.findUnique({ where: { id } });
    if (
      !shift ||
      (actor.role === 'FRONT_DESK' && shift.staffId !== actor.staffId)
    ) {
      throw new NotFoundException('Shift not found');
    }
    return shift;
  }
}
