import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FolioController } from './folio.controller';
import { FolioService } from './folio.service';
import { InvoiceController } from './invoice.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceService } from './invoice.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { PaystackProvider } from './providers/paystack.provider';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    FolioController,
    InvoiceController,
    PaymentController,
    WebhooksController,
  ],
  providers: [
    FolioService,
    InvoiceService,
    PaymentService,
    InvoicePdfService,
    PaystackProvider,
    FlutterwaveProvider,
  ],
  exports: [InvoiceService, PaymentService],
})
export class BillingModule {}
