import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PaginatedResponse,
  RestaurantTableDto,
} from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { ListRestaurantTablesQueryDto } from './dto/list-restaurant-tables-query.dto';
import { SetRestaurantTableStatusDto } from './dto/set-restaurant-table-status.dto';
import { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import { toRestaurantTableDto } from './restaurant-table.mapper';

@Injectable()
export class RestaurantTableService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListRestaurantTablesQueryDto,
  ): Promise<PaginatedResponse<RestaurantTableDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.RestaurantTableWhereInput = {
      ...(query.search
        ? { tableNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [tables, total] = await Promise.all([
      this.prisma.restaurantTable.findMany({
        where,
        skip,
        take,
        orderBy: { tableNumber: 'asc' },
      }),
      this.prisma.restaurantTable.count({ where }),
    ]);
    return buildPaginatedResponse(
      tables.map(toRestaurantTableDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<RestaurantTableDto> {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
    });
    if (!table) {
      throw new NotFoundException('Restaurant table not found');
    }
    return toRestaurantTableDto(table);
  }

  async create(dto: CreateRestaurantTableDto): Promise<RestaurantTableDto> {
    const table = await this.prisma.restaurantTable.create({ data: dto });
    return toRestaurantTableDto(table);
  }

  async update(
    id: string,
    dto: UpdateRestaurantTableDto,
  ): Promise<RestaurantTableDto> {
    await this.findOneOrThrow(id);
    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: dto,
    });
    return toRestaurantTableDto(table);
  }

  /** Manual status flagging (e.g. marking a table reserved or needing a
   * clean) — kept separate from `update` the same way Room exposes
   * maintenance flagging on its own route. Order creation/cancellation/
   * billing also drive this field directly via RestaurantOrderService,
   * under the table lock, rather than through this method. */
  async setStatus(
    id: string,
    dto: SetRestaurantTableStatusDto,
  ): Promise<RestaurantTableDto> {
    await this.findOneOrThrow(id);
    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: { status: dto.status },
    });
    return toRestaurantTableDto(table);
  }
}
