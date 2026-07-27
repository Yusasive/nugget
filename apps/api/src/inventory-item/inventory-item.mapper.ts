import type { InventoryItemDto } from '@nugget/shared-types';
import type { InventoryItem } from '../generated/prisma/client';

export function toInventoryItemDto(item: InventoryItem): InventoryItemDto {
  return {
    id: item.id,
    branchId: item.branchId,
    name: item.name,
    unit: item.unit,
    quantityOnHand: item.quantityOnHand.toString(),
    reorderThreshold: item.reorderThreshold.toString(),
    unitCost: item.unitCost.toString(),
    isLowStock: item.quantityOnHand.lte(item.reorderThreshold),
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
