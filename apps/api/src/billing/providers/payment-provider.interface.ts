import type { PaymentMethod } from '@nugget/shared-types';

export interface InitializeTransactionParams {
  /** Our own idempotent reference — becomes Payment.providerReference. */
  reference: string;
  /** Decimal string, major currency units (naira), e.g. "5000.00". */
  amount: string;
  email: string;
  /** Where the guest lands after completing (or abandoning) checkout. */
  callbackUrl: string;
  channel: PaymentMethod;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
}

export interface VerifyTransactionResult {
  successful: boolean;
  /** Decimal string, major currency units, as confirmed by the provider. */
  amount: string;
}

export interface RefundResult {
  /** True once the provider has fully processed the refund; false if it's
   * only been accepted and remains pending on the provider's side. */
  successful: boolean;
}

/**
 * One interface both gateways implement so PaymentService never branches on
 * "which provider" beyond picking which implementation to call (TRD's
 * Paystack/Flutterwave dual-integration requirement). Built against each
 * provider's public API contract but — per the Milestone 5 scope decision —
 * not yet exercised against a live sandbox; that needs real secret keys in
 * apps/api/.env (see README's "Manual setup still required").
 */
export interface PaymentProviderClient {
  initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult>;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
  refund(reference: string, amount: string): Promise<RefundResult>;
  /** Confirms a webhook payload actually came from the provider before any
   * of its contents are trusted (TRD §10). */
  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean;
}
