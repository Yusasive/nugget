import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MenuCategoryDto, PaginatedResponse } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { ListMenuCategoriesQueryDto } from './dto/list-menu-categories-query.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { toMenuCategoryDto } from './menu-category.mapper';

@Injectable()
export class MenuCategoryService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListMenuCategoriesQueryDto,
  ): Promise<PaginatedResponse<MenuCategoryDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.MenuCategoryWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [categories, total] = await Promise.all([
      this.prisma.menuCategory.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.menuCategory.count({ where }),
    ]);
    return buildPaginatedResponse(
      categories.map(toMenuCategoryDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<MenuCategoryDto> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Menu category not found');
    }
    return toMenuCategoryDto(category);
  }

  async create(dto: CreateMenuCategoryDto): Promise<MenuCategoryDto> {
    const category = await this.prisma.menuCategory.create({ data: dto });
    return toMenuCategoryDto(category);
  }

  async update(
    id: string,
    dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategoryDto> {
    await this.findOneOrThrow(id);
    const category = await this.prisma.menuCategory.update({
      where: { id },
      data: dto,
    });
    return toMenuCategoryDto(category);
  }
}
