import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  InitiatePaymentResponse,
  InvoiceDto,
  PaymentDto,
  RefundDto,
} from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { computeInvoiceAmountPaid } from './billing.util';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { INVOICE_INCLUDE, toInvoiceDto } from './invoice.mapper';
import { PAYMENT_INCLUDE, toPaymentDto, toRefundDto } from './payment.mapper';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import type { PaymentProviderClient } from './providers/payment-provider.interface';
import { PaystackProvider } from './providers/paystack.provider';

type GatewayProviderName = 'PAYSTACK' | 'FLUTTERWAVE';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
    private readonly paystack: PaystackProvider,
    private readonly flutterwave: FlutterwaveProvider,
  ) {}

  private providerFor(provider: GatewayProviderName): PaymentProviderClient {
    return provider === 'PAYSTACK' ? this.paystack : this.flutterwave;
  }

  /**
   * MANUAL settles immediately (staff is logging money already in hand — a
   * CASH payment is also attributed to their open shift, same pattern as
   * Milestone 4's check-in deposit auto-attribution). PAYSTACK/FLUTTERWAVE
   * instead calls out to the gateway's initialize API and returns a
   * redirect URL, leaving the payment PENDING until the gateway confirms it.
   */
  async createPayment(
    invoiceId: string,
    dto: CreatePaymentDto,
    actor: ActorContext,
  ): Promise<InitiatePaymentResponse> {
    const invoice = await this.scopedPrisma.invoice.findUnique({
      where: { id: invoiceId },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === 'VOID') {
      throw new ConflictException('Cannot pay a void invoice');
    }

    const amountPaid = computeInvoiceAmountPaid(invoice.payments);
    const balanceDue = invoice.totalAmount.sub(amountPaid);
    const requested = new Prisma.Decimal(dto.amount);
    if (requested.lte(0)) {
      throw new BadRequestException('amount must be greater than zero');
    }
    if (requested.gt(balanceDue)) {
      throw new BadRequestException(
        `amount exceeds the outstanding balance of ${balanceDue.toString()}`,
      );
    }

    const provider = dto.provider ?? 'MANUAL';

    if (provider === 'MANUAL') {
      return this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            branchId: invoice.branchId,
            invoiceId,
            amount: dto.amount,
            method: dto.method,
            provider: 'MANUAL',
            status: 'SUCCESSFUL',
            paidAt: new Date(),
            recordedByStaffId: actor.staffId,
          },
          include: PAYMENT_INCLUDE,
        });

        if (dto.method === 'CASH') {
          const openShift = await tx.shift.findFirst({
            where: { staffId: actor.staffId, status: 'OPEN' },
          });
          if (openShift) {
            await tx.shiftTransaction.create({
              data: {
                branchId: invoice.branchId,
                shiftId: openShift.id,
                type: 'CASH_IN',
                amount: dto.amount,
                description: 'Invoice payment',
                bookingId: invoice.bookingId,
                recordedByStaffId: actor.staffId,
              },
            });
          }
        }

        await this.audit.record(tx, {
          staffId: actor.staffId,
          branchId: invoice.branchId,
          action: 'payment.create',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: { amount: dto.amount, method: dto.method },
        });
        return { payment: toPaymentDto(payment) };
      });
    }

    if (!invoice.guestId) {
      throw new BadRequestException(
        'This invoice has no guest attached; required to initiate a gateway payment',
      );
    }
    const guest = await this.prisma.guest.findUniqueOrThrow({
      where: { id: invoice.guestId },
    });
    if (!guest.email) {
      throw new BadRequestException(
        'Guest has no email on file; required to initiate a gateway payment',
      );
    }

    const corsOrigin =
      this.configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
    const reference = `NUG-${randomUUID()}`;
    const client = this.providerFor(provider);
    const initResult = await client.initializeTransaction({
      reference,
      amount: dto.amount,
      email: guest.email,
      callbackUrl: `${corsOrigin}/payments/callback?reference=${reference}`,
      channel: dto.method,
    });

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          branchId: invoice.branchId,
          invoiceId,
          amount: dto.amount,
          method: dto.method,
          provider,
          providerReference: reference,
          status: 'PENDING',
          recordedByStaffId: actor.staffId,
        },
        include: PAYMENT_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: invoice.branchId,
        action: 'payment.initiate',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { provider, amount: dto.amount, reference },
      });
      return {
        payment: toPaymentDto(payment),
        authorizationUrl: initResult.authorizationUrl,
      };
    });
  }

  /**
   * A manual re-check against the gateway — useful when a webhook hasn't
   * arrived yet (or, in dev without a public webhook URL, ever). Idempotent:
   * re-verifying an already-resolved payment just returns it unchanged.
   */
  async verifyPayment(
    paymentId: string,
    actor: ActorContext,
  ): Promise<PaymentDto> {
    const payment = await this.scopedPrisma.payment.findUnique({
      where: { id: paymentId },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.provider === 'MANUAL') {
      throw new BadRequestException('Manual payments do not need verification');
    }
    if (payment.status !== 'PENDING') {
      return toPaymentDto(payment);
    }

    const client = this.providerFor(payment.provider);
    const result = await client.verifyTransaction(
      payment.providerReference as string,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: result.successful ? 'SUCCESSFUL' : 'FAILED',
          paidAt: result.successful ? new Date() : undefined,
          failureReason: result.successful
            ? undefined
            : 'Gateway reported an unsuccessful transaction',
        },
        include: PAYMENT_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: payment.branchId,
        action: 'payment.verify',
        entityType: 'Payment',
        entityId: paymentId,
        metadata: { successful: result.successful },
      });
      return toPaymentDto(updated);
    });
  }

  /**
   * TRD §10: never trust a webhook's own claim of success — the signature
   * only proves the request came from the provider, so this re-verifies the
   * transaction against the provider's own verify API before marking
   * anything SUCCESSFUL. Silently no-ops on an unknown or already-resolved
   * reference so a duplicate delivery (which every gateway can send) is
   * harmless rather than an error.
   */
  async handleWebhook(
    provider: GatewayProviderName,
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<void> {
    const client = this.providerFor(provider);
    if (!client.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const reference = extractReference(provider, rawBody);
    if (!reference) return;

    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: reference },
    });
    if (!payment || payment.status !== 'PENDING') return;

    const result = await client.verifyTransaction(reference);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: result.successful ? 'SUCCESSFUL' : 'FAILED',
          paidAt: result.successful ? new Date() : undefined,
        },
      });
      await this.audit.record(tx, {
        staffId: null,
        branchId: payment.branchId,
        action: 'payment.webhook',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { provider, successful: result.successful },
      });
    });
  }

  async refundPayment(
    paymentId: string,
    dto: CreateRefundDto,
    actor: ActorContext,
  ): Promise<RefundDto> {
    const payment = await this.scopedPrisma.payment.findUnique({
      where: { id: paymentId },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (
      payment.status !== 'SUCCESSFUL' &&
      payment.status !== 'PARTIALLY_REFUNDED'
    ) {
      throw new ConflictException(
        `Cannot refund a payment with status ${payment.status}`,
      );
    }

    const alreadyRefunded = payment.refunds
      .filter((r) => r.status === 'SUCCESSFUL')
      .reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0));
    const refundable = payment.amount.sub(alreadyRefunded);
    const requested = new Prisma.Decimal(dto.amount);
    if (requested.lte(0)) {
      throw new BadRequestException('amount must be greater than zero');
    }
    if (requested.gt(refundable)) {
      throw new BadRequestException(
        `amount exceeds the refundable balance of ${refundable.toString()}`,
      );
    }
    const nextPaymentStatus = alreadyRefunded.add(requested).gte(payment.amount)
      ? ('REFUNDED' as const)
      : ('PARTIALLY_REFUNDED' as const);

    if (payment.provider === 'MANUAL') {
      return this.prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({
          data: {
            branchId: payment.branchId,
            paymentId,
            amount: dto.amount,
            reason: dto.reason,
            provider: 'MANUAL',
            status: 'SUCCESSFUL',
            processedByStaffId: actor.staffId,
            processedAt: new Date(),
          },
          include: { processedByStaff: true },
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: nextPaymentStatus },
        });

        if (payment.method === 'CASH') {
          const openShift = await tx.shift.findFirst({
            where: { staffId: actor.staffId, status: 'OPEN' },
          });
          if (openShift) {
            await tx.shiftTransaction.create({
              data: {
                branchId: payment.branchId,
                shiftId: openShift.id,
                type: 'CASH_OUT',
                amount: dto.amount,
                description: 'Refund issued',
                recordedByStaffId: actor.staffId,
              },
            });
          }
        }

        await this.audit.record(tx, {
          staffId: actor.staffId,
          branchId: payment.branchId,
          action: 'refund.create',
          entityType: 'Payment',
          entityId: paymentId,
          metadata: { amount: dto.amount, reason: dto.reason },
        });
        return toRefundDto(refund);
      });
    }

    const client = this.providerFor(payment.provider);
    const result = await client.refund(
      payment.providerReference as string,
      dto.amount,
    );

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          branchId: payment.branchId,
          paymentId,
          amount: dto.amount,
          reason: dto.reason,
          provider: payment.provider,
          status: result.successful ? 'SUCCESSFUL' : 'PENDING',
          processedByStaffId: actor.staffId,
          processedAt: result.successful ? new Date() : undefined,
        },
        include: { processedByStaff: true },
      });
      if (result.successful) {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: nextPaymentStatus },
        });
      }
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: payment.branchId,
        action: 'refund.create',
        entityType: 'Payment',
        entityId: paymentId,
        metadata: { amount: dto.amount, provider: payment.provider },
      });
      return toRefundDto(refund);
    });
  }

  /** Everything invoice-pdf.service.ts needs to render a receipt, gathered
   * in one place so the controller doesn't touch Prisma directly. */
  async getReceiptContext(paymentId: string): Promise<{
    branchName: string;
    payment: PaymentDto;
    invoice: InvoiceDto;
  }> {
    const payment = await this.scopedPrisma.payment.findUnique({
      where: { id: paymentId },
      include: { ...PAYMENT_INCLUDE, invoice: { include: { branch: true } } },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (
      payment.status !== 'SUCCESSFUL' &&
      payment.status !== 'PARTIALLY_REFUNDED' &&
      payment.status !== 'REFUNDED'
    ) {
      throw new BadRequestException(
        'Only a payment that has succeeded can produce a receipt',
      );
    }

    const invoiceWithRelations =
      await this.scopedPrisma.invoice.findUniqueOrThrow({
        where: { id: payment.invoiceId },
        include: INVOICE_INCLUDE,
      });
    return {
      branchName: payment.invoice.branch.name,
      payment: toPaymentDto(payment),
      invoice: toInvoiceDto(invoiceWithRelations),
    };
  }
}

/** Each gateway nests its transaction reference differently in the webhook payload. */
function extractReference(
  provider: GatewayProviderName,
  rawBody: Buffer,
): string | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    return null;
  }
  const data = payload.data;
  if (typeof data !== 'object' || data === null) return null;

  const key = provider === 'PAYSTACK' ? 'reference' : 'tx_ref';
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}
