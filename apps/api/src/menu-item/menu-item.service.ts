import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MenuItemDto, PaginatedResponse } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MENU_ITEM_INCLUDE, toMenuItemDto } from './menu-item.mapper';

@Injectable()
export class MenuItemService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListMenuItemsQueryDto,
  ): Promise<PaginatedResponse<MenuItemDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.MenuItemWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isAvailable !== undefined
        ? { isAvailable: query.isAvailable }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.menuItem.findMany({
        where,
        skip,
        take,
        include: MENU_ITEM_INCLUDE,
        orderBy: { name: 'asc' },
      }),
      this.prisma.menuItem.count({ where }),
    ]);
    return buildPaginatedResponse(
      items.map(toMenuItemDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<MenuItemDto> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: MENU_ITEM_INCLUDE,
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return toMenuItemDto(item);
  }

  async create(dto: CreateMenuItemDto): Promise<MenuItemDto> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Menu category not found');
    }
    const item = await this.prisma.menuItem.create({
      data: dto,
      include: MENU_ITEM_INCLUDE,
    });
    return toMenuItemDto(item);
  }

  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItemDto> {
    await this.findOneOrThrow(id);
    if (dto.categoryId) {
      const category = await this.prisma.menuCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Menu category not found');
      }
    }
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: dto,
      include: MENU_ITEM_INCLUDE,
    });
    return toMenuItemDto(item);
  }
}
