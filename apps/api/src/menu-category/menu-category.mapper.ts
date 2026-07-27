import type { MenuCategoryDto } from '@nugget/shared-types';
import type { MenuCategory } from '../generated/prisma/client';

export function toMenuCategoryDto(category: MenuCategory): MenuCategoryDto {
  return {
    id: category.id,
    branchId: category.branchId,
    name: category.name,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
