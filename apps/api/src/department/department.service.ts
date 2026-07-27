import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DepartmentDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

function toDto(department: {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}): DepartmentDto {
  return {
    id: department.id,
    branchId: department.branchId,
    name: department.name,
    isActive: department.isActive,
  };
}

@Injectable()
export class DepartmentService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  /**
   * `branchId` is only honored for Super Admin: for everyone else the
   * branch-scoping extension silently forces it to the actor's own branch
   * regardless of what's requested here, so this is a convenience filter,
   * not the security boundary.
   */
  async list(branchId?: string, isActive?: boolean): Promise<DepartmentDto[]> {
    const where: Prisma.DepartmentWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const departments = await this.prisma.department.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return departments.map(toDto);
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentDto> {
    const department = await this.prisma.department.create({ data: dto });
    return toDto(department);
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentDto> {
    const existing = await this.prisma.department.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    const department = await this.prisma.department.update({
      where: { id },
      data: dto,
    });
    return toDto(department);
  }
}
