import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { PaymentDto, RefundDto } from '@nugget/shared-types';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CreateRefundDto } from './dto/create-refund.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { PaymentService } from './payment.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Post(':id/verify')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  verify(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<PaymentDto> {
    return this.paymentService.verifyPayment(id, actor);
  }

  @Post(':id/refund')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT')
  refund(
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<RefundDto> {
    return this.paymentService.refundPayment(id, dto, actor);
  }

  @Get(':id/receipt.pdf')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  async receipt(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { branchName, payment, invoice } =
      await this.paymentService.getReceiptContext(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="receipt-${invoice.invoiceNumber}-${payment.id.slice(0, 8)}.pdf"`,
    );
    const doc = this.invoicePdfService.renderReceipt(
      branchName,
      payment,
      invoice,
    );
    doc.pipe(res);
  }
}
