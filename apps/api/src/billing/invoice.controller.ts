import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { InitiatePaymentResponse, InvoiceDto } from '@nugget/shared-types';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FolioService } from './folio.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly folioService: FolioService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  list(): Promise<InvoiceDto[]> {
    return this.invoiceService.list();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  findOne(@Param('id') id: string): Promise<InvoiceDto> {
    return this.invoiceService.findOneOrThrow(id);
  }

  @Post(':id/void')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT')
  void(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<InvoiceDto> {
    return this.invoiceService.voidInvoice(id, actor);
  }

  @Post(':id/payments')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  createPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<InitiatePaymentResponse> {
    return this.paymentService.createPayment(id, dto, actor);
  }

  @Get(':id/pdf')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  async pdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const invoice = await this.invoiceService.findOneOrThrow(id);
    if (!invoice.bookingId) {
      // Milestone 6: a standalone tour-booking invoice has no folio to
      // render a PDF from — full tour-invoice PDF rendering is an explicit
      // scope cut for this milestone, tracked as a fast-follow.
      throw new BadRequestException(
        'Tour invoice PDF export is not yet supported',
      );
    }
    const { branchName, booking } = await this.invoiceService.getPdfContext(id);
    const folio = await this.folioService.getFolio(invoice.bookingId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    );
    const doc = this.invoicePdfService.renderInvoice(
      branchName,
      invoice,
      booking,
      folio.charges,
    );
    doc.pipe(res);
  }
}
