import { Injectable } from '@nestjs/common';
import type {
  FolioChargeDto,
  InvoiceDto,
  PaymentDto,
} from '@nugget/shared-types';
import PDFDocument from 'pdfkit';

export interface InvoicePdfBookingSummary {
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
}

@Injectable()
export class InvoicePdfService {
  /**
   * Line items shown are the folio charges that existed at issuance time
   * (approximated as "created before the invoice was issued", since there
   * is no InvoiceLineItem join table snapshotting exactly which charges a
   * given invoice billed — a deliberate Phase-1 simplification alongside
   * "one active invoice per booking, void-and-reissue to amend").
   */
  renderInvoice(
    branchName: string,
    invoice: InvoiceDto,
    booking: InvoicePdfBookingSummary,
    charges: FolioChargeDto[],
  ): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const billedCharges = charges.filter(
      (c) => new Date(c.createdAt) <= new Date(invoice.issuedAt),
    );

    doc.fontSize(20).text(branchName, { align: 'left' });
    doc.fontSize(10).text('Invoice', { align: 'left' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice: ${invoice.invoiceNumber}`);
    doc.text(`Issued: ${new Date(invoice.issuedAt).toLocaleString()}`);
    doc.text(`Status: ${invoice.status} (${invoice.paymentStatus})`);
    doc.moveDown();

    doc.text(`Guest: ${booking.guestName}`);
    doc.text(`Room: ${booking.roomNumber}`);
    doc.text(
      `Stay: ${new Date(booking.checkInDate).toLocaleDateString()} - ${new Date(booking.checkOutDate).toLocaleDateString()}`,
    );
    doc.moveDown();

    const incidentalsTotal = billedCharges.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );
    const roomAndFees = Number(invoice.totalAmount) - incidentalsTotal;

    doc.fontSize(12).text('Charges', { underline: true });
    doc
      .fontSize(10)
      .text(
        `Room charge (incl. any early/late fee): ${roomAndFees.toFixed(2)}`,
      );
    for (const charge of billedCharges) {
      doc.text(`${charge.description} (${charge.category}): ${charge.amount}`);
    }
    doc.moveDown();

    doc.fontSize(12).text(`Total: ${invoice.totalAmount}`, { align: 'right' });
    doc.text(`Amount paid: ${invoice.amountPaid}`, { align: 'right' });
    doc.text(`Balance due: ${invoice.balanceDue}`, { align: 'right' });

    doc.end();
    return doc;
  }

  renderReceipt(
    branchName: string,
    payment: PaymentDto,
    invoice: InvoiceDto,
  ): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.fontSize(20).text(branchName, { align: 'left' });
    doc.fontSize(10).text('Receipt', { align: 'left' });
    doc.moveDown();

    doc.fontSize(12).text(`Receipt for invoice: ${invoice.invoiceNumber}`);
    doc.text(`Payment method: ${payment.method}`);
    doc.text(`Provider: ${payment.provider}`);
    if (payment.providerReference) {
      doc.text(`Reference: ${payment.providerReference}`);
    }
    doc.text(
      `Paid at: ${payment.paidAt ? new Date(payment.paidAt).toLocaleString() : 'N/A'}`,
    );
    doc.moveDown();

    doc.fontSize(14).text(`Amount: ${payment.amount}`, { align: 'right' });

    doc.end();
    return doc;
  }
}
