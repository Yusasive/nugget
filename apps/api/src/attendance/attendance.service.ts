import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AttendanceDto, PaginatedResponse } from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { ActorContext } from '../context/actor.types';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { ATTENDANCE_INCLUDE, toAttendanceDto } from './attendance.mapper';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListAttendanceQueryDto,
  ): Promise<PaginatedResponse<AttendanceDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.AttendanceWhereInput = {
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.departmentId
        ? { staff: { departmentId: query.departmentId } }
        : {}),
      ...(query.date ? { date: startOfUtcDay(new Date(query.date)) } : {}),
      // Only takes effect for Super Admin — the branch-scoping extension
      // force-overwrites this for every other role regardless.
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };

    const [attendances, total] = await Promise.all([
      this.scopedPrisma.attendance.findMany({
        where,
        skip,
        take,
        include: ATTENDANCE_INCLUDE,
        orderBy: { clockIn: 'desc' },
      }),
      this.scopedPrisma.attendance.count({ where }),
    ]);
    return buildPaginatedResponse(
      attendances.map(toAttendanceDto),
      total,
      page,
      pageSize,
    );
  }

  /** One open (clockOut null) attendance row per staff member at a time —
   * the same partial-uniqueness-can't-be-expressed-in-Prisma-DSL situation
   * as Shift, enforced here instead. */
  async clockIn(actor: ActorContext): Promise<AttendanceDto> {
    const existingOpen = await this.scopedPrisma.attendance.findFirst({
      where: { staffId: actor.staffId, clockOut: null },
    });
    if (existingOpen) {
      throw new ConflictException('Already clocked in — clock out first');
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const attendance = await tx.attendance.create({
        data: {
          branchId: actor.branchId,
          staffId: actor.staffId,
          clockIn: now,
          date: startOfUtcDay(now),
        },
        include: ATTENDANCE_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: actor.branchId,
        action: 'attendance.clock-in',
        entityType: 'Attendance',
        entityId: attendance.id,
      });
      return toAttendanceDto(attendance);
    });
  }

  async clockOut(actor: ActorContext): Promise<AttendanceDto> {
    const open = await this.scopedPrisma.attendance.findFirst({
      where: { staffId: actor.staffId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (!open) {
      throw new NotFoundException('No open attendance record to clock out of');
    }

    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.update({
        where: { id: open.id },
        data: { clockOut: new Date() },
        include: ATTENDANCE_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: actor.branchId,
        action: 'attendance.clock-out',
        entityType: 'Attendance',
        entityId: attendance.id,
      });
      return toAttendanceDto(attendance);
    });
  }
}
