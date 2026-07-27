import type { PaginationQuery } from "./pagination";
import type { GuestDto } from "./booking";

// --- MenuCategory ---

export interface MenuCategoryDto {
  id: string;
  branchId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuCategoryRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  name: string;
  displayOrder?: number;
}

export interface UpdateMenuCategoryRequestBody {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ListMenuCategoriesQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

// --- MenuItem ---

export interface MenuItemDto {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string };
}

export interface CreateMenuItemRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: string;
}

export interface UpdateMenuItemRequestBody {
  categoryId?: string;
  name?: string;
  description?: string;
  price?: string;
  isAvailable?: boolean;
}

export interface ListMenuItemsQuery extends PaginationQuery {
  search?: string;
  categoryId?: string;
  isAvailable?: boolean;
}

// --- RestaurantTable ---

export const RESTAURANT_TABLE_STATUSES = [
  "FREE",
  "OCCUPIED",
  "RESERVED",
  "NEEDS_CLEANING",
] as const;
export type RestaurantTableStatus = (typeof RESTAURANT_TABLE_STATUSES)[number];

export interface RestaurantTableDto {
  id: string;
  branchId: string;
  tableNumber: string;
  capacity: number;
  status: RestaurantTableStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRestaurantTableRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  tableNumber: string;
  capacity: number;
}

export interface UpdateRestaurantTableRequestBody {
  tableNumber?: string;
  capacity?: number;
  isActive?: boolean;
}

export interface SetRestaurantTableStatusRequestBody {
  status: RestaurantTableStatus;
}

export interface ListRestaurantTablesQuery extends PaginationQuery {
  search?: string;
  status?: RestaurantTableStatus;
  isActive?: boolean;
}

// --- RestaurantOrder / OrderItem ---

export const RESTAURANT_ORDER_TYPES = [
  "DINE_IN",
  "ROOM_SERVICE",
  "TAKEAWAY",
] as const;
export type RestaurantOrderType = (typeof RESTAURANT_ORDER_TYPES)[number];

export const RESTAURANT_ORDER_STATUSES = [
  "OPEN",
  "SENT_TO_KITCHEN",
  "SERVED",
  "PAID",
  "CANCELLED",
] as const;
export type RestaurantOrderStatus = (typeof RESTAURANT_ORDER_STATUSES)[number];

export const KITCHEN_ITEM_STATUSES = [
  "PENDING",
  "PREPARING",
  "READY",
  "SERVED",
] as const;
export type KitchenItemStatus = (typeof KITCHEN_ITEM_STATUSES)[number];

export interface OrderItemDto {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  notes: string | null;
  kitchenStatus: KitchenItemStatus;
  unitPriceAtOrder: string;
  createdAt: string;
}

export interface RestaurantOrderDto {
  id: string;
  branchId: string;
  orderType: RestaurantOrderType;
  status: RestaurantOrderStatus;
  table: { id: string; tableNumber: string } | null;
  roomBookingId: string | null;
  guest: GuestDto | null;
  items: OrderItemDto[];
  totalAmount: string;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRestaurantOrderRequestBody {
  orderType: RestaurantOrderType;
  /** Required, DINE_IN only. */
  tableId?: string;
  /** Required, ROOM_SERVICE only. */
  roomBookingId?: string;
  /** Optional, any order type. */
  guestId?: string;
}

export interface AddOrderItemInput {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

export interface AddOrderItemsRequestBody {
  items: AddOrderItemInput[];
}

export interface UpdateKitchenItemStatusRequestBody {
  status: KitchenItemStatus;
}

export interface CancelRestaurantOrderRequestBody {
  reason?: string;
}

export interface ListRestaurantOrdersQuery extends PaginationQuery {
  status?: RestaurantOrderStatus;
  orderType?: RestaurantOrderType;
  tableId?: string;
}
