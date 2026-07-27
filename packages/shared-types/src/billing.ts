export const FOLIO_CHARGE_CATEGORIES = [
  "INCIDENTAL",
  "FEE",
  "TOUR",
  "RESTAURANT",
] as const;
export type FolioChargeCategory = (typeof FOLIO_CHARGE_CATEGORIES)[number];

export interface FolioChargeDto {
  id: string;
  bookingId: string;
  category: FolioChargeCategory;
  description: string;
  amount: string;
  createdByStaff: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface CreateFolioChargeRequestBody {
  category?: FolioChargeCategory;
  description: string;
  amount: string;
}

/** PRD §5.7's unified guest folio — computed live from the booking, its
 * fees, incidental charges, and any invoices/payments against it. */
export interface FolioDto {
  bookingId: string;
  roomCharge: string;
  earlyCheckInFee: string | null;
  lateCheckOutFee: string | null;
  charges: FolioChargeDto[];
  invoices: InvoiceDto[];
  totalCharges: string;
  totalPaid: string;
  balanceDue: string;
}

export const INVOICE_STATUSES = ["ISSUED", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
] as const;
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export interface InvoiceDto {
  id: string;
  branchId: string;
  /** Milestone 6/7: exactly one of bookingId/tourBookingId/restaurantOrderId
   * is set — see schema.prisma. */
  bookingId: string | null;
  tourBookingId: string | null;
  restaurantOrderId: string | null;
  /** Milestone 7: null for an anonymous walk-in dine-in/takeaway order. */
  guestId: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  /** Derived from the payment/refund ledger, never stored — see schema.prisma. */
  paymentStatus: InvoicePaymentStatus;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  issuedAt: string;
  voidedAt: string | null;
  payments: PaymentDto[];
}

export const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "USSD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = ["MANUAL", "PAYSTACK", "FLUTTERWAVE"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "SUCCESSFUL",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface PaymentDto {
  id: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  provider: PaymentProvider;
  providerReference: string | null;
  status: PaymentStatus;
  recordedByStaff: { id: string; firstName: string; lastName: string } | null;
  paidAt: string | null;
  failureReason: string | null;
  refunds: RefundDto[];
  createdAt: string;
}

/** provider defaults to MANUAL (a cash/POS payment already collected in person). */
export interface CreatePaymentRequestBody {
  method: PaymentMethod;
  amount: string;
  provider?: PaymentProvider;
}

/** For a MANUAL payment, authorizationUrl is absent — it's already settled.
 * For a gateway payment, the frontend redirects the guest to authorizationUrl. */
export interface InitiatePaymentResponse {
  payment: PaymentDto;
  authorizationUrl?: string;
}

export const REFUND_STATUSES = ["PENDING", "SUCCESSFUL", "FAILED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface RefundDto {
  id: string;
  paymentId: string;
  amount: string;
  reason: string | null;
  provider: PaymentProvider;
  providerReference: string | null;
  status: RefundStatus;
  processedByStaff: { id: string; firstName: string; lastName: string } | null;
  processedAt: string | null;
  createdAt: string;
}

export interface CreateRefundRequestBody {
  amount: string;
  reason?: string;
}
