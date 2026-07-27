import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type {
  ExpenseReportDto,
  InventoryReportDto,
  OccupancyReportDto,
  ProfitAndLossDto,
  RestaurantSalesReportDto,
} from '@nugget/shared-types';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { DateRangeReportQueryDto } from './dto/date-range-report-query.dto';
import { InventoryReportQueryDto } from './dto/inventory-report-query.dto';
import { ProfitAndLossQueryDto } from './dto/profit-and-loss-query.dto';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportsService } from './reports.service';
import { toCsv } from './reports.util';

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

const MANAGEMENT_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT'] as const;

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  @Get('occupancy')
  @Roles(...MANAGEMENT_ROLES)
  async occupancy(
    @Query() query: DateRangeReportQueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() actor: ActorContext,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reportsService.getOccupancyReport(query, actor);
    if (format === 'csv') {
      const rows = report.byBranch ?? [report];
      const csv = toCsv(
        [
          { key: 'branchName', label: 'Branch' },
          { key: 'occupancyRate', label: 'Occupancy Rate' },
          { key: 'adr', label: 'ADR' },
          { key: 'revPar', label: 'RevPAR' },
          { key: 'roomRevenue', label: 'Room Revenue' },
        ],
        rows.map((r) => ({ ...r, branchName: r.branchName ?? 'All Branches' })),
      );
      sendCsv(res, 'occupancy-report.csv', csv);
      return;
    }
    res.json(report satisfies OccupancyReportDto);
  }

  @Get('restaurant-sales')
  @Roles(...MANAGEMENT_ROLES, 'RESTAURANT_STAFF')
  async restaurantSales(
    @Query() query: DateRangeReportQueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() actor: ActorContext,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reportsService.getRestaurantSalesReport(query, actor);
    if (format === 'csv') {
      const csv = toCsv(
        [
          { key: 'orderType', label: 'Order Type' },
          { key: 'total', label: 'Total' },
          { key: 'orderCount', label: 'Order Count' },
        ],
        report.byOrderType,
      );
      sendCsv(res, 'restaurant-sales-report.csv', csv);
      return;
    }
    res.json(report satisfies RestaurantSalesReportDto);
  }

  @Get('inventory')
  @Roles(...MANAGEMENT_ROLES, 'RESTAURANT_STAFF')
  async inventory(
    @Query() query: InventoryReportQueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() actor: ActorContext,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reportsService.getInventoryReport(query, actor);
    if (format === 'csv') {
      const csv = toCsv(
        [
          { key: 'name', label: 'Item' },
          { key: 'unit', label: 'Unit' },
          { key: 'quantityOnHand', label: 'Qty On Hand' },
          { key: 'unitCost', label: 'Unit Cost' },
          { key: 'value', label: 'Value' },
          { key: 'isLowStock', label: 'Low Stock' },
        ],
        report.items,
      );
      sendCsv(res, 'inventory-report.csv', csv);
      return;
    }
    res.json(report satisfies InventoryReportDto);
  }

  @Get('expenses')
  @Roles(...MANAGEMENT_ROLES)
  async expenses(
    @Query() query: DateRangeReportQueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() actor: ActorContext,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reportsService.getExpenseReport(query, actor);
    if (format === 'csv') {
      const csv = toCsv(
        [
          { key: 'categoryName', label: 'Category' },
          { key: 'total', label: 'Total' },
        ],
        report.byCategory,
      );
      sendCsv(res, 'expense-report.csv', csv);
      return;
    }
    res.json(report satisfies ExpenseReportDto);
  }

  @Get('profit-and-loss')
  @Roles(...MANAGEMENT_ROLES)
  async profitAndLoss(
    @Query() query: ProfitAndLossQueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() actor: ActorContext,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reportsService.getProfitAndLoss(query, actor);
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="profit-and-loss-${report.month}.pdf"`,
      );
      const doc = this.reportsPdfService.renderProfitAndLoss(report);
      doc.pipe(res);
      doc.end();
      return;
    }
    if (format === 'csv') {
      const rows = report.byBranch ?? [report];
      const csv = toCsv(
        [
          { key: 'branchName', label: 'Branch' },
          { key: 'roomRevenue', label: 'Room Revenue' },
          { key: 'restaurantRevenue', label: 'Restaurant Revenue' },
          { key: 'tourRevenue', label: 'Tour Revenue' },
          { key: 'totalRevenue', label: 'Total Revenue' },
          { key: 'totalExpenses', label: 'Total Expenses' },
          { key: 'netProfit', label: 'Net Profit' },
        ],
        rows.map((r) => ({ ...r, branchName: r.branchName ?? 'All Branches' })),
      );
      sendCsv(res, `profit-and-loss-${report.month}.csv`, csv);
      return;
    }
    res.json(report satisfies ProfitAndLossDto);
  }
}
