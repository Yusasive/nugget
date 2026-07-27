import type { PaginationQuery } from "./pagination";

// --- Supplier ---

export interface SupplierDto {
  id: string;
  branchId: string;
  name: string;
  phone: string | null;
  contactNotes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  name: string;
  phone?: string;
  contactNotes?: string;
}

export interface UpdateSupplierRequestBody {
  name?: string;
  phone?: string;
  contactNotes?: string;
  isActive?: boolean;
}

export interface ListSuppliersQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

// --- InventoryItem ---

export interface InventoryItemDto {
  id: string;
  branchId: string;
  name: string;
  unit: string;
  quantityOnHand: string;
  reorderThreshold: string;
  unitCost: string;
  /** quantityOnHand <= reorderThreshold — computed at read time, not stored. */
  isLowStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  name: string;
  unit: string;
  reorderThreshold: string;
  unitCost: string;
}

export interface UpdateInventoryItemRequestBody {
  name?: string;
  unit?: string;
  reorderThreshold?: string;
  unitCost?: string;
  isActive?: boolean;
}

export interface ListInventoryItemsQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
  lowStockOnly?: boolean;
}

export const STOCK_MOVEMENT_TYPES = ["IN", "OUT"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_REASONS = [
  "PURCHASE",
  "CONSUMPTION",
  "WASTE",
  "ADJUSTMENT",
] as const;
export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number];

export interface StockMovementDto {
  id: string;
  inventoryItemId: string;
  type: StockMovementType;
  quantity: string;
  reason: StockMovementReason;
  referenceId: string | null;
  createdByStaffId: string;
  createdAt: string;
}

/** Manual stock in/out recording (PRD §5.10) — PURCHASE-reason movements are
 * created only by PurchaseRecordService, never through this endpoint. */
export interface RecordStockMovementRequestBody {
  type: StockMovementType;
  quantity: string;
  reason: Exclude<StockMovementReason, "PURCHASE">;
}

// --- PurchaseRecord ---

export interface PurchaseLineItemInput {
  inventoryItemId: string;
  quantity: string;
  unitCost: string;
}

export interface PurchaseLineItem extends PurchaseLineItemInput {
  inventoryItemName: string;
}

export interface PurchaseRecordDto {
  id: string;
  branchId: string;
  supplier: { id: string; name: string };
  lineItems: PurchaseLineItem[];
  totalCost: string;
  purchasedAt: string;
  createdByStaffId: string;
  createdAt: string;
  expenseId: string | null;
}

export interface CreatePurchaseRecordRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  supplierId: string;
  lineItems: PurchaseLineItemInput[];
  purchasedAt?: string;
}

export interface ListPurchaseRecordsQuery extends PaginationQuery {
  supplierId?: string;
}

// --- ExpenseCategory / Expense (read-only in Milestone 8 — the approval
// flow, manual entry, and reports are Milestone 9 scope) ---

export interface ExpenseCategoryDto {
  id: string;
  branchId: string | null;
  name: string;
}

export interface CreateExpenseCategoryRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  name: string;
}

export const EXPENSE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export interface ExpenseDto {
  id: string;
  branchId: string;
  category: ExpenseCategoryDto;
  purchaseRecordId: string | null;
  amount: string;
  description: string;
  incurredAt: string;
  status: ExpenseStatus;
  createdByStaffId: string;
  approvedByStaffId: string | null;
  createdAt: string;
}

export interface ListExpensesQuery extends PaginationQuery {
  status?: ExpenseStatus;
  /** Only takes effect for Super Admin — every other role is force-scoped to their own branch server-side. */
  branchId?: string;
}

export interface CreateExpenseRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  categoryId: string;
  amount: string;
  description: string;
  incurredAt?: string;
}

export interface ApproveRejectExpenseRequestBody {
  action: 'APPROVE' | 'REJECT';
}
