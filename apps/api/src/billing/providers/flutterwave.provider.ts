import { timingSafeEqual } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  InitializeTransactionParams,
  InitializeTransactionResult,
  PaymentProviderClient,
  RefundResult,
  VerifyTransactionResult,
} from './payment-provider.interface';

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

const PAYMENT_OPTIONS_MAP: Record<string, string> = {
  CARD: 'card',
  BANK_TRANSFER: 'banktransfer',
  USSD: 'ussd',
};

interface FlutterwaveInitializeResponse {
  data: { link: string };
}
interface FlutterwaveVerifyResponse {
  data: { id: number; status: string; amount: number };
}
interface FlutterwaveRefundResponse {
  data: { status: string };
}

/**
 * Built against Flutterwave's public v3 REST API
 * (https://developer.flutterwave.com/docs). Unverified against a live
 * sandbox pending real keys — see payment-provider.interface.ts's doc
 * comment and the README.
 *
 * Flutterwave's refund endpoint needs *its* internal numeric transaction
 * id, not the tx_ref we generate — verify-by-reference is what maps one to
 * the other, so refund() calls it first rather than asking callers to
 * track a second id alongside our own reference.
 */
@Injectable()
export class FlutterwaveProvider implements PaymentProviderClient {
  constructor(private readonly configService: ConfigService) {}

  private get secretKey(): string {
    const key = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'FLUTTERWAVE_SECRET_KEY is not configured',
      );
    }
    return key;
  }

  private get webhookHash(): string {
    const hash = this.configService.get<string>('FLUTTERWAVE_WEBHOOK_HASH');
    if (!hash) {
      throw new InternalServerErrorException(
        'FLUTTERWAVE_WEBHOOK_HASH is not configured',
      );
    }
    return hash;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${FLUTTERWAVE_BASE_URL}${path}`, {
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
        `Flutterwave request failed: ${res.status}`,
      );
    }
    return body;
  }

  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    const result = await this.request<FlutterwaveInitializeResponse>(
      '/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          tx_ref: params.reference,
          amount: params.amount,
          currency: 'NGN',
          redirect_url: params.callbackUrl,
          customer: { email: params.email },
          payment_options: PAYMENT_OPTIONS_MAP[params.channel],
        }),
      },
    );
    return { authorizationUrl: result.data.link };
  }

  private async verifyByReference(
    reference: string,
  ): Promise<FlutterwaveVerifyResponse> {
    return this.request<FlutterwaveVerifyResponse>(
      `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const result = await this.verifyByReference(reference);
    return {
      successful: result.data.status === 'successful',
      amount: result.data.amount.toFixed(2),
    };
  }

  async refund(reference: string, amount: string): Promise<RefundResult> {
    const verified = await this.verifyByReference(reference);
    const result = await this.request<FlutterwaveRefundResponse>(
      `/transactions/${verified.data.id}/refund`,
      { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) },
    );
    return { successful: result.data.status === 'success' };
  }

  verifyWebhookSignature(
    _rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    if (!signatureHeader) return false;
    const expectedBuf = Buffer.from(this.webhookHash, 'utf8');
    const actualBuf = Buffer.from(signatureHeader, 'utf8');
    return (
      expectedBuf.length === actualBuf.length &&
      timingSafeEqual(expectedBuf, actualBuf)
    );
  }
}
