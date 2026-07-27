import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResponse, SupplierDto } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { toSupplierDto } from './supplier.mapper';

@Injectable()
export class SupplierService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListSuppliersQueryDto,
  ): Promise<PaginatedResponse<SupplierDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.SupplierWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return buildPaginatedResponse(
      suppliers.map(toSupplierDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<SupplierDto> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return toSupplierDto(supplier);
  }

  async create(dto: CreateSupplierDto): Promise<SupplierDto> {
    const supplier = await this.prisma.supplier.create({ data: dto });
    return toSupplierDto(supplier);
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierDto> {
    await this.findOneOrThrow(id);
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
    return toSupplierDto(supplier);
  }
}
