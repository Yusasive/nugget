import type { MenuItemDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const MENU_ITEM_INCLUDE = {
  category: true,
} as const;

export type MenuItemWithRelations = Prisma.MenuItemGetPayload<{
  include: typeof MENU_ITEM_INCLUDE;
}>;

export function toMenuItemDto(item: MenuItemWithRelations): MenuItemDto {
  return {
    id: item.id,
    branchId: item.branchId,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    price: item.price.toString(),
    isAvailable: item.isAvailable,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    category: { id: item.category.id, name: item.category.name },
  };
}
