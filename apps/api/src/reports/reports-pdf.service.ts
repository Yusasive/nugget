import { Injectable } from '@nestjs/common';
import type { ProfitAndLossDto } from '@nugget/shared-types';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportsPdfService {
  /** PRD §5.14's P&L export — same pdfkit approach as InvoicePdfService,
   * the only other PDF surface in this codebase. */
  renderProfitAndLoss(pl: ProfitAndLossDto): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.fontSize(18).text(pl.branchName ?? 'All Branches (Consolidated)');
    doc.fontSize(10).text(`Profit & Loss — ${pl.month}`);
    doc.moveDown();

    doc.fontSize(12).text('Revenue');
    doc.fontSize(10).text(`Rooms: ${pl.roomRevenue}`);
    doc.text(`Restaurant: ${pl.restaurantRevenue}`);
    doc.text(`Tours: ${pl.tourRevenue}`);
    doc.fontSize(11).text(`Total revenue: ${pl.totalRevenue}`);
    doc.moveDown();

    doc.fontSize(12).text('Expenses');
    for (const line of pl.expensesByCategory) {
      doc.fontSize(10).text(`${line.categoryName}: ${line.total}`);
    }
    doc.fontSize(11).text(`Total expenses: ${pl.totalExpenses}`);
    doc.moveDown();

    doc.fontSize(14).text(`Net profit: ${pl.netProfit}`);

    if (pl.byBranch && pl.byBranch.length > 0) {
      doc.moveDown();
      doc.fontSize(12).text('By branch');
      for (const branch of pl.byBranch) {
        doc
          .fontSize(10)
          .text(
            `${branch.branchName}: revenue ${branch.totalRevenue}, expenses ${branch.totalExpenses}, net ${branch.netProfit}`,
          );
      }
    }

    return doc;
  }
}
