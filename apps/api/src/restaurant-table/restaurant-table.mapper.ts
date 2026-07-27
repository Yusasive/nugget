import type { RestaurantTableDto } from '@nugget/shared-types';
import type { RestaurantTable } from '../generated/prisma/client';

export function toRestaurantTableDto(
  table: RestaurantTable,
): RestaurantTableDto {
  return {
    id: table.id,
    branchId: table.branchId,
    tableNumber: table.tableNumber,
    capacity: table.capacity,
    status: table.status,
    isActive: table.isActive,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  };
}
