import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BranchScopeDto,
  ExpenseCategoryLineDto,
  ExpenseReportDto,
  InventoryReportDto,
  OccupancyReportDto,
  ProfitAndLossDto,
  RestaurantSalesByTypeLine,
  RestaurantSalesReportDto,
} from '@nugget/shared-types';
import type { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeOrderTotal } from '../restaurant-order/restaurant-order.util';
import { DateRangeReportQueryDto } from './dto/date-range-report-query.dto';
import { InventoryReportQueryDto } from './dto/inventory-report-query.dto';
import { ProfitAndLossQueryDto } from './dto/profit-and-loss-query.dto';
import {
  computeOccupancyMetrics,
  parseDateRange,
  parseMonthRange,
  type OccupancyMetrics,
} from './reports.util';

type BranchScope =
  { mode: 'single'; branchId: string } | { mode: 'consolidated' };

interface BranchLike {
  id: string;
  name: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every report shares this rule: non-Super-Admin is always forced to
   * their own branch; Super Admin gets a single branch when one is
   * requested, or the consolidated company-wide view when it's omitted. */
  private resolveScope(
    actor: ActorContext,
    requestedBranchId?: string,
  ): BranchScope {
    if (actor.role !== 'SUPER_ADMIN') {
      return { mode: 'single', branchId: actor.branchId };
    }
    return requestedBranchId
      ? { mode: 'single', branchId: requestedBranchId }
      : { mode: 'consolidated' };
  }

  private async findBranchOrThrow(branchId: string): Promise<BranchLike> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async activeBranches(): Promise<BranchLike[]> {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // --- Occupancy / ADR / RevPAR ---------------------------------------

  private async computeOccupancy(
    branchId: string | undefined,
    start: Date,
    end: Date,
  ): Promise<OccupancyMetrics> {
    const [activeRoomCount, bookings] = await Promise.all([
      this.prisma.room.count({
        where: {
          isActive: true,
          isOutOfOrder: false,
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.booking.findMany({
        where: {
          status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
          checkInDate: { lt: end },
          checkOutDate: { gt: start },
          ...(branchId ? { branchId } : {}),
        },
        select: { checkInDate: true, checkOutDate: true, totalAmount: true },
      }),
    ]);
    return computeOccupancyMetrics(bookings, activeRoomCount, start, end);
  }

  private toOccupancyDto(
    branch: BranchScopeDto,
    start: Date,
    end: Date,
    metrics: OccupancyMetrics,
  ): OccupancyReportDto {
    return {
      ...branch,
      from: start.toISOString(),
      to: end.toISOString(),
      availableRoomNights: metrics.availableRoomNights,
      occupiedRoomNights: metrics.occupiedRoomNights,
      occupancyRate: metrics.occupancyRate.toString(),
      roomRevenue: metrics.roomRevenue.toString(),
      adr: metrics.adr.toString(),
      revPar: metrics.revPar.toString(),
    };
  }

  async getOccupancyReport(
    query: DateRangeReportQueryDto,
    actor: ActorContext,
  ): Promise<OccupancyReportDto> {
    const { start, end } = parseDateRange(query.from, query.to);
    const scope = this.resolveScope(actor, query.branchId);

    if (scope.mode === 'single') {
      const branch = await this.findBranchOrThrow(scope.branchId);
      const metrics = await this.computeOccupancy(branch.id, start, end);
      return this.toOccupancyDto(
        { branchId: branch.id, branchName: branch.name },
        start,
        end,
        metrics,
      );
    }

    const [consolidated, branches] = await Promise.all([
      this.computeOccupancy(undefined, start, end),
      this.activeBranches(),
    ]);
    const byBranch = await Promise.all(
      branches.map(async (branch) => {
        const metrics = await this.computeOccupancy(branch.id, start, end);
        return this.toOccupancyDto(
          { branchId: branch.id, branchName: branch.name },
          start,
          end,
          metrics,
        );
      }),
    );
    return {
      ...this.toOccupancyDto(
        { branchId: null, branchName: null },
        start,
        end,
        consolidated,
      ),
      byBranch,
    };
  }

  // --- Restaurant sales -------------------------------------------------

  private async computeRestaurantSales(
    branchId: string | undefined,
    start: Date,
    end: Date,
  ): Promise<{
    totalSales: Prisma.Decimal;
    orderCount: number;
    byOrderType: RestaurantSalesByTypeLine[];
  }> {
    const orders = await this.prisma.restaurantOrder.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: start, lt: end },
        ...(branchId ? { branchId } : {}),
      },
      include: { items: true },
    });

    let totalSales = new Prisma.Decimal(0);
    const byType = new Map<
      string,
      { total: Prisma.Decimal; orderCount: number }
    >();
    for (const order of orders) {
      const orderTotal = computeOrderTotal(order.items);
      totalSales = totalSales.add(orderTotal);
      const existing = byType.get(order.orderType) ?? {
        total: new Prisma.Decimal(0),
        orderCount: 0,
      };
      byType.set(order.orderType, {
        total: existing.total.add(orderTotal),
        orderCount: existing.orderCount + 1,
      });
    }

    return {
      totalSales,
      orderCount: orders.length,
      byOrderType: [...byType.entries()].map(([orderType, v]) => ({
        orderType: orderType as RestaurantSalesByTypeLine['orderType'],
        total: v.total.toString(),
        orderCount: v.orderCount,
      })),
    };
  }

  async getRestaurantSalesReport(
    query: DateRangeReportQueryDto,
    actor: ActorContext,
  ): Promise<RestaurantSalesReportDto> {
    const { start, end } = parseDateRange(query.from, query.to);
    const scope = this.resolveScope(actor, query.branchId);

    const toDto = (
      branch: BranchScopeDto,
      sales: Awaited<ReturnType<ReportsService['computeRestaurantSales']>>,
    ): RestaurantSalesReportDto => ({
      ...branch,
      from: start.toISOString(),
      to: end.toISOString(),
      totalSales: sales.totalSales.toString(),
      orderCount: sales.orderCount,
      byOrderType: sales.byOrderType,
    });

    if (scope.mode === 'single') {
      const branch = await this.findBranchOrThrow(scope.branchId);
      const sales = await this.computeRestaurantSales(branch.id, start, end);
      return toDto({ branchId: branch.id, branchName: branch.name }, sales);
    }

    const [consolidated, branches] = await Promise.all([
      this.computeRestaurantSales(undefined, start, end),
      this.activeBranches(),
    ]);
    const byBranch = await Promise.all(
      branches.map(async (branch) => {
        const sales = await this.computeRestaurantSales(branch.id, start, end);
        return toDto({ branchId: branch.id, branchName: branch.name }, sales);
      }),
    );
    return {
      ...toDto({ branchId: null, branchName: null }, consolidated),
      byBranch,
    };
  }

  // --- Inventory valuation ----------------------------------------------

  private async computeInventoryValuation(branchId: string | undefined) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { isActive: true, ...(branchId ? { branchId } : {}) },
      orderBy: { name: 'asc' },
    });
    const lines = items.map((item) => ({
      inventoryItemId: item.id,
      name: item.name,
      unit: item.unit,
      quantityOnHand: item.quantityOnHand.toString(),
      unitCost: item.unitCost.toString(),
      value: item.quantityOnHand.mul(item.unitCost).toString(),
      isLowStock: item.quantityOnHand.lte(item.reorderThreshold),
    }));
    const totalValue = items.reduce(
      (sum, item) => sum.add(item.quantityOnHand.mul(item.unitCost)),
      new Prisma.Decimal(0),
    );
    const lowStockCount = lines.filter((l) => l.isLowStock).length;
    return { items: lines, totalValue, lowStockCount };
  }

  async getInventoryReport(
    query: InventoryReportQueryDto,
    actor: ActorContext,
  ): Promise<InventoryReportDto> {
    const scope = this.resolveScope(actor, query.branchId);

    const toDto = (
      branch: BranchScopeDto,
      valuation: Awaited<
        ReturnType<ReportsService['computeInventoryValuation']>
      >,
    ): InventoryReportDto => ({
      ...branch,
      totalValue: valuation.totalValue.toString(),
      lowStockCount: valuation.lowStockCount,
      items: valuation.items,
    });

    if (scope.mode === 'single') {
      const branch = await this.findBranchOrThrow(scope.branchId);
      const valuation = await this.computeInventoryValuation(branch.id);
      return toDto({ branchId: branch.id, branchName: branch.name }, valuation);
    }

    const [consolidated, branches] = await Promise.all([
      this.computeInventoryValuation(undefined),
      this.activeBranches(),
    ]);
    const byBranch = await Promise.all(
      branches.map(async (branch) => {
        const valuation = await this.computeInventoryValuation(branch.id);
        return toDto(
          { branchId: branch.id, branchName: branch.name },
          valuation,
        );
      }),
    );
    return {
      ...toDto({ branchId: null, branchName: null }, consolidated),
      byBranch,
    };
  }

  // --- Expenses -----------------------------------------------------------

  private async computeExpenses(
    branchId: string | undefined,
    start: Date,
    end: Date,
  ): Promise<{
    totalExpenses: Prisma.Decimal;
    byCategory: ExpenseCategoryLineDto[];
  }> {
    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'APPROVED',
        incurredAt: { gte: start, lt: end },
        ...(branchId ? { branchId } : {}),
      },
      include: { category: true },
    });

    const byCategory = new Map<
      string,
      { name: string; total: Prisma.Decimal }
    >();
    let totalExpenses = new Prisma.Decimal(0);
    for (const expense of expenses) {
      totalExpenses = totalExpenses.add(expense.amount);
      const existing = byCategory.get(expense.categoryId) ?? {
        name: expense.category.name,
        total: new Prisma.Decimal(0),
      };
      byCategory.set(expense.categoryId, {
        name: existing.name,
        total: existing.total.add(expense.amount),
      });
    }

    return {
      totalExpenses,
      byCategory: [...byCategory.entries()].map(([categoryId, v]) => ({
        categoryId,
        categoryName: v.name,
        total: v.total.toString(),
      })),
    };
  }

  async getExpenseReport(
    query: DateRangeReportQueryDto,
    actor: ActorContext,
  ): Promise<ExpenseReportDto> {
    const { start, end } = parseDateRange(query.from, query.to);
    const scope = this.resolveScope(actor, query.branchId);

    const toDto = (
      branch: BranchScopeDto,
      report: Awaited<ReturnType<ReportsService['computeExpenses']>>,
    ): ExpenseReportDto => ({
      ...branch,
      from: start.toISOString(),
      to: end.toISOString(),
      totalExpenses: report.totalExpenses.toString(),
      byCategory: report.byCategory,
    });

    if (scope.mode === 'single') {
      const branch = await this.findBranchOrThrow(scope.branchId);
      const report = await this.computeExpenses(branch.id, start, end);
      return toDto({ branchId: branch.id, branchName: branch.name }, report);
    }

    const [consolidated, branches] = await Promise.all([
      this.computeExpenses(undefined, start, end),
      this.activeBranches(),
    ]);
    const byBranch = await Promise.all(
      branches.map(async (branch) => {
        const report = await this.computeExpenses(branch.id, start, end);
        return toDto({ branchId: branch.id, branchName: branch.name }, report);
      }),
    );
    return {
      ...toDto({ branchId: null, branchName: null }, consolidated),
      byBranch,
    };
  }

  // --- Profit & Loss --------------------------------------------------------

  /**
   * PRD §5.14/M12's headline report: revenue (rooms + restaurant + tours)
   * minus approved expenses, for one calendar month. Each revenue line
   * reuses its own domain's canonical total (Booking.totalAmount,
   * RestaurantOrder's line items, TourBooking.totalAmount) rather than the
   * FolioCharge rows a bundled tour or room-service order also lands on a
   * room's folio — summing folio charges *and* their source domain's own
   * total would double-count that revenue.
   */
  private async computeProfitAndLoss(
    branchId: string | undefined,
    start: Date,
    end: Date,
  ) {
    const [occupancy, restaurant, expenses, tourBookings] = await Promise.all([
      this.computeOccupancy(branchId, start, end),
      this.computeRestaurantSales(branchId, start, end),
      this.computeExpenses(branchId, start, end),
      this.prisma.tourBooking.findMany({
        where: {
          status: 'CONFIRMED',
          tourDeparture: { departureAt: { gte: start, lt: end } },
          ...(branchId ? { branchId } : {}),
        },
        select: { totalAmount: true },
      }),
    ]);

    const tourRevenue = tourBookings.reduce(
      (sum, b) => sum.add(b.totalAmount),
      new Prisma.Decimal(0),
    );
    const totalRevenue = occupancy.roomRevenue
      .add(restaurant.totalSales)
      .add(tourRevenue);
    const netProfit = totalRevenue.sub(expenses.totalExpenses);

    return {
      roomRevenue: occupancy.roomRevenue,
      restaurantRevenue: restaurant.totalSales,
      tourRevenue,
      totalRevenue,
      expensesByCategory: expenses.byCategory,
      totalExpenses: expenses.totalExpenses,
      netProfit,
    };
  }

  async getProfitAndLoss(
    query: ProfitAndLossQueryDto,
    actor: ActorContext,
  ): Promise<ProfitAndLossDto> {
    const { start, end } = parseMonthRange(query.month);
    const scope = this.resolveScope(actor, query.branchId);

    const toDto = (
      branch: BranchScopeDto,
      pl: Awaited<ReturnType<ReportsService['computeProfitAndLoss']>>,
    ): ProfitAndLossDto => ({
      ...branch,
      month: query.month,
      roomRevenue: pl.roomRevenue.toString(),
      restaurantRevenue: pl.restaurantRevenue.toString(),
      tourRevenue: pl.tourRevenue.toString(),
      totalRevenue: pl.totalRevenue.toString(),
      expensesByCategory: pl.expensesByCategory,
      totalExpenses: pl.totalExpenses.toString(),
      netProfit: pl.netProfit.toString(),
    });

    if (scope.mode === 'single') {
      const branch = await this.findBranchOrThrow(scope.branchId);
      const pl = await this.computeProfitAndLoss(branch.id, start, end);
      return toDto({ branchId: branch.id, branchName: branch.name }, pl);
    }

    const [consolidated, branches] = await Promise.all([
      this.computeProfitAndLoss(undefined, start, end),
      this.activeBranches(),
    ]);
    const byBranch = await Promise.all(
      branches.map(async (branch) => {
        const pl = await this.computeProfitAndLoss(branch.id, start, end);
        return toDto({ branchId: branch.id, branchName: branch.name }, pl);
      }),
    );
    return {
      ...toDto({ branchId: null, branchName: null }, consolidated),
      byBranch,
    };
  }
}
