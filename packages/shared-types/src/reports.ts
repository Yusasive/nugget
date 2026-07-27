import type { RestaurantOrderType } from "./restaurant";

/** Every report query shares this shape: an optional explicit date range
 * (defaults are report-specific, applied server-side) and a branchId that
 * only takes effect for Super Admin — every other role is force-scoped to
 * their own branch server-side, same convention as every other list query
 * in this codebase. Omitting branchId as Super Admin requests the
 * consolidated, company-wide view (see `byBranch` on each report DTO). */
export interface DateRangeReportQuery {
  from?: string;
  to?: string;
  branchId?: string;
}

export interface ProfitAndLossQuery {
  /** "YYYY-MM" */
  month: string;
  branchId?: string;
}

export interface BranchScopeDto {
  branchId: string | null;
  branchName: string | null;
}

export interface OccupancyReportDto extends BranchScopeDto {
  from: string;
  to: string;
  availableRoomNights: number;
  occupiedRoomNights: number;
  /** Fraction 0-1, e.g. "0.62" — the frontend formats as a percentage. */
  occupancyRate: string;
  roomRevenue: string;
  /** Average Daily Rate: roomRevenue / occupiedRoomNights. */
  adr: string;
  /** Revenue Per Available Room: roomRevenue / availableRoomNights. */
  revPar: string;
  /** Present only on a consolidated (no branchId) Super Admin request. */
  byBranch?: OccupancyReportDto[];
}

export interface RestaurantSalesByTypeLine {
  orderType: RestaurantOrderType;
  total: string;
  orderCount: number;
}

export interface RestaurantSalesReportDto extends BranchScopeDto {
  from: string;
  to: string;
  totalSales: string;
  orderCount: number;
  byOrderType: RestaurantSalesByTypeLine[];
  byBranch?: RestaurantSalesReportDto[];
}

export interface InventoryValuationLineDto {
  inventoryItemId: string;
  name: string;
  unit: string;
  quantityOnHand: string;
  unitCost: string;
  value: string;
  isLowStock: boolean;
}

export interface InventoryReportDto extends BranchScopeDto {
  totalValue: string;
  lowStockCount: number;
  items: InventoryValuationLineDto[];
  byBranch?: InventoryReportDto[];
}

export interface ExpenseCategoryLineDto {
  categoryId: string;
  categoryName: string;
  total: string;
}

export interface ExpenseReportDto extends BranchScopeDto {
  from: string;
  to: string;
  totalExpenses: string;
  byCategory: ExpenseCategoryLineDto[];
  byBranch?: ExpenseReportDto[];
}

/** PRD §5.14's headline report: revenue (rooms + restaurant + tours) minus
 * approved expenses, for one calendar month. */
export interface ProfitAndLossDto extends BranchScopeDto {
  month: string;
  roomRevenue: string;
  restaurantRevenue: string;
  tourRevenue: string;
  totalRevenue: string;
  expensesByCategory: ExpenseCategoryLineDto[];
  totalExpenses: string;
  netProfit: string;
  byBranch?: ProfitAndLossDto[];
}
