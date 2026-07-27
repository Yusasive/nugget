import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  StockMovementReason,
  StockMovementType,
} from '@nugget/shared-types';
import { Prisma } from '../generated/prisma/client';
import type { InventoryItem } from '../generated/prisma/client';

/**
 * The one place InventoryItem.quantityOnHand is ever written — shared by
 * InventoryItemService (manual stock in/out) and PurchaseRecordService (the
 * atomic purchase transaction, TRD §4), so both go through the same
 * row-locked read-then-write instead of two independently-racy code paths.
 * `SELECT ... FOR UPDATE` inside the caller's transaction serializes
 * concurrent movements against the same item — the same "row lock inside
 * one Postgres transaction" backstop used for booking/tour-departure
 * concurrency elsewhere, just without a Redis lock in front of it since
 * stock adjustments aren't a two-party race the way seating a table is.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  params: {
    branchId: string;
    inventoryItemId: string;
    type: StockMovementType;
    quantity: Prisma.Decimal | string;
    reason: StockMovementReason;
    referenceId?: string;
    createdByStaffId: string;
  },
): Promise<{ item: InventoryItem; movementId: string }> {
  const quantity = new Prisma.Decimal(params.quantity);
  if (quantity.lte(0)) {
    throw new BadRequestException('quantity must be greater than zero');
  }

  const [item] = await tx.$queryRaw<InventoryItem[]>`
    SELECT * FROM "InventoryItem"
    WHERE id = ${params.inventoryItemId} AND "branchId" = ${params.branchId}
    FOR UPDATE
  `;
  if (!item) {
    throw new NotFoundException('Inventory item not found');
  }

  const delta = params.type === 'IN' ? quantity : quantity.negated();
  const newQuantity = item.quantityOnHand.add(delta);
  if (newQuantity.lt(0)) {
    throw new BadRequestException(
      `Not enough stock: ${item.quantityOnHand.toString()} on hand, cannot remove ${quantity.toString()}`,
    );
  }

  const updated = await tx.inventoryItem.update({
    where: { id: item.id },
    data: { quantityOnHand: newQuantity },
  });
  const movement = await tx.stockMovement.create({
    data: {
      branchId: params.branchId,
      inventoryItemId: item.id,
      type: params.type,
      quantity,
      reason: params.reason,
      referenceId: params.referenceId,
      createdByStaffId: params.createdByStaffId,
    },
  });

  return { item: updated, movementId: movement.id };
}
