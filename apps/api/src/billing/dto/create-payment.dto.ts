import { IsEnum, IsOptional, Matches } from 'class-validator';
import {
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  type CreatePaymentRequestBody,
  type PaymentMethod,
  type PaymentProvider,
} from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreatePaymentDto implements CreatePaymentRequestBody {
  @IsEnum(PAYMENT_METHODS)
  method: PaymentMethod;

  @Matches(MONEY_PATTERN, { message: 'amount must look like "50" or "50.00"' })
  amount: string;

  @IsOptional()
  @IsEnum(PAYMENT_PROVIDERS)
  provider?: PaymentProvider;
}
