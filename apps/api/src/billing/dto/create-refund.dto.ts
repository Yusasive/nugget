import { IsOptional, IsString, Matches } from 'class-validator';
import type { CreateRefundRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateRefundDto implements CreateRefundRequestBody {
  @Matches(MONEY_PATTERN, { message: 'amount must look like "50" or "50.00"' })
  amount: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
