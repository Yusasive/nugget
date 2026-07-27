import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PaginatedResponse, StaffDto } from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { ActorContext } from '../context/actor.types';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { toStaffDto } from './staff.mapper';

const STAFF_INCLUDE = { role: true, branch: true, department: true } as const;

@Injectable()
export class StaffService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
    private readonly audit: AuditService,
  ) {}

  /**
   * Reads go through the scoped client: for Super Admin this returns every
   * branch, for anyone else the branch-scoping extension silently narrows
   * `where` to their own branchId (TRD §3.7) — there is no separate
   * "am I allowed to see this branch's staff" check to remember here.
   */
  async list(query: ListStaffQueryDto): Promise<PaginatedResponse<StaffDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.StaffWhereInput = {
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [staff, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip,
        take,
        include: STAFF_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.staff.count({ where }),
    ]);
    return buildPaginatedResponse(staff.map(toStaffDto), total, page, pageSize);
  }

  async findOneOrThrow(id: string): Promise<StaffDto> {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: STAFF_INCLUDE,
    });
    if (!staff) {
      // Deliberately the same 404 whether the id doesn't exist at all or it
      // belongs to a branch the actor can't see — never confirm existence
      // of another branch's data.
      throw new NotFoundException('Staff member not found');
    }
    return toStaffDto(staff);
  }

  async create(dto: CreateStaffDto, actor: ActorContext): Promise<StaffDto> {
    const existing = await this.prisma.staff.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        'A staff member with this email already exists',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          branchId: dto.branchId,
          roleId: dto.roleId,
          departmentId: dto.departmentId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
        include: STAFF_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: staff.branchId,
        action: 'staff.create',
        entityType: 'Staff',
        entityId: staff.id,
      });
      return toStaffDto(staff);
    });
  }

  async update(
    id: string,
    dto: UpdateStaffDto,
    actor: ActorContext,
  ): Promise<StaffDto> {
    await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.update({
        where: { id },
        data: dto,
        include: STAFF_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: staff.branchId,
        action: 'staff.update',
        entityType: 'Staff',
        entityId: staff.id,
        metadata: dto as Record<string, unknown>,
      });
      return toStaffDto(staff);
    });
  }

  /** Distinct from `update`: UpdateOwnProfileDto's type only carries
   * firstName/lastName/phone, so there's no roleId/departmentId/isActive
   * for a self-edit to ever reach Prisma with — self-service can't
   * privilege-escalate through this path even if the controller guard was
   * ever loosened. */
  async updateSelf(
    id: string,
    dto: UpdateOwnProfileDto,
    actor: ActorContext,
  ): Promise<StaffDto> {
    await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.update({
        where: { id },
        data: dto,
        include: STAFF_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: staff.branchId,
        action: 'staff.update-profile',
        entityType: 'Staff',
        entityId: staff.id,
        metadata: { firstName: dto.firstName, lastName: dto.lastName, phoneChanged: dto.phone !== undefined },
      });
      return toStaffDto(staff);
    });
  }
}
