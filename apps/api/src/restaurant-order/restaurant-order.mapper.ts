import type { OrderItemDto, RestaurantOrderDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';
import { computeOrderTotal } from './restaurant-order.util';

export const ORDER_ITEM_INCLUDE = {
  menuItem: true,
} as const;

export const RESTAURANT_ORDER_INCLUDE = {
  table: true,
  guest: true,
  items: { include: ORDER_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } },
} as const;

export type RestaurantOrderWithRelations = Prisma.RestaurantOrderGetPayload<{
  include: typeof RESTAURANT_ORDER_INCLUDE;
}>;

type OrderItemWithRelations = Prisma.OrderItemGetPayload<{
  include: typeof ORDER_ITEM_INCLUDE;
}>;

export function toOrderItemDto(item: OrderItemWithRelations): OrderItemDto {
  return {
    id: item.id,
    orderId: item.orderId,
    menuItemId: item.menuItemId,
    menuItemName: item.menuItem.name,
    quantity: item.quantity,
    notes: item.notes,
    kitchenStatus: item.kitchenStatus,
    unitPriceAtOrder: item.unitPriceAtOrder.toString(),
    createdAt: item.createdAt.toISOString(),
  };
}

export function toRestaurantOrderDto(
  order: RestaurantOrderWithRelations,
): RestaurantOrderDto {
  return {
    id: order.id,
    branchId: order.branchId,
    orderType: order.orderType,
    status: order.status,
    table: order.table
      ? { id: order.table.id, tableNumber: order.table.tableNumber }
      : null,
    roomBookingId: order.roomBookingId,
    guest: order.guest
      ? {
          id: order.guest.id,
          firstName: order.guest.firstName,
          lastName: order.guest.lastName,
          email: order.guest.email,
          phone: order.guest.phone,
        }
      : null,
    items: order.items.map(toOrderItemDto),
    totalAmount: computeOrderTotal(order.items).toString(),
    createdByStaffId: order.createdByStaffId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
