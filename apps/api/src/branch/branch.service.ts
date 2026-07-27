import { Injectable, NotFoundException } from '@nestjs/common';
import type { BranchDto, PaginatedResponse } from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toBranchDto } from './branch.mapper';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ListBranchesQueryDto } from './dto/list-branches-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListBranchesQueryDto,
  ): Promise<PaginatedResponse<BranchDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.BranchWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.branch.count({ where }),
    ]);
    return buildPaginatedResponse(
      branches.map(toBranchDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<BranchDto> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return toBranchDto(branch);
  }

  async create(dto: CreateBranchDto, actor: ActorContext): Promise<BranchDto> {
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data: dto });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: branch.id,
        action: 'branch.create',
        entityType: 'Branch',
        entityId: branch.id,
      });
      return toBranchDto(branch);
    });
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    actor: ActorContext,
  ): Promise<BranchDto> {
    await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({ where: { id }, data: dto });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: branch.id,
        action: 'branch.update',
        entityType: 'Branch',
        entityId: branch.id,
        metadata: dto as Record<string, unknown>,
      });
      return toBranchDto(branch);
    });
  }
}
