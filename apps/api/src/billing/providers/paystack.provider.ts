import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  InitializeTransactionParams,
  InitializeTransactionResult,
  PaymentProviderClient,
  RefundResult,
  VerifyTransactionResult,
} from './payment-provider.interface';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const CHANNEL_MAP: Record<string, string[]> = {
  CARD: ['card'],
  BANK_TRANSFER: ['bank_transfer'],
  USSD: ['ussd'],
};

interface PaystackInitializeResponse {
  data: { authorization_url: string };
}
interface PaystackVerifyResponse {
  data: { status: string; amount: number };
}
interface PaystackRefundResponse {
  data: { status: string };
}

/**
 * Built against Paystack's public REST API (https://paystack.com/docs/api/).
 * Unverified against a live sandbox pending real keys — see
 * payment-provider.interface.ts's doc comment and the README.
 */
@Injectable()
export class PaystackProvider implements PaymentProviderClient {
  constructor(private readonly configService: ConfigService) {}

  private get secretKey(): string {
    const key = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'PAYSTACK_SECRET_KEY is not configured',
      );
    }
    return key;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const body = (await res.json()) as T;
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Paystack request failed: ${res.status}`,
      );
    }
    return body;
  }

  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    const amountInKobo = Math.round(Number(params.amount) * 100);
    const result = await this.request<PaystackInitializeResponse>(
      '/transaction/initialize',
      {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          amount: amountInKobo,
          reference: params.reference,
          callback_url: params.callbackUrl,
          channels: CHANNEL_MAP[params.channel],
        }),
      },
    );
    return { authorizationUrl: result.data.authorization_url };
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const result = await this.request<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
    return {
      successful: result.data.status === 'success',
      amount: (result.data.amount / 100).toFixed(2),
    };
  }

  async refund(reference: string, amount: string): Promise<RefundResult> {
    const amountInKobo = Math.round(Number(amount) * 100);
    const result = await this.request<PaystackRefundResponse>('/refund', {
      method: 'POST',
      body: JSON.stringify({ transaction: reference, amount: amountInKobo }),
    });
    return { successful: result.data.status === 'processed' };
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    if (!signatureHeader) return false;
    const expected = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signatureHeader, 'utf8');
    return (
      expectedBuf.length === actualBuf.length &&
      timingSafeEqual(expectedBuf, actualBuf)
    );
  }
}
