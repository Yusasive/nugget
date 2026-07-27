import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';

/**
 * Public, unauthenticated on purpose — Paystack/Flutterwave call these
 * directly, with no JWT to present. Protected instead by signature
 * verification inside PaymentService.handleWebhook (TRD §10).
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('paystack')
  @HttpCode(200)
  async paystack(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ): Promise<{ received: true }> {
    await this.paymentService.handleWebhook(
      'PAYSTACK',
      req.rawBody ?? Buffer.from(''),
      signature,
    );
    return { received: true };
  }

  @Post('flutterwave')
  @HttpCode(200)
  async flutterwave(
    @Req() req: RawBodyRequest<Request>,
    @Headers('verif-hash') signature?: string,
  ): Promise<{ received: true }> {
    await this.paymentService.handleWebhook(
      'FLUTTERWAVE',
      req.rawBody ?? Buffer.from(''),
      signature,
    );
    return { received: true };
  }
}
