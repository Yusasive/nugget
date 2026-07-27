import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import {
  SHIFT_TRANSACTION_TYPES,
  type CreateShiftTransactionRequestBody,
  type ShiftTransactionType,
} from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateShiftTransactionDto implements CreateShiftTransactionRequestBody {
  @IsEnum(SHIFT_TRANSACTION_TYPES)
  type: ShiftTransactionType;

  @Matches(MONEY_PATTERN, { message: 'amount must look like "50" or "50.00"' })
  amount: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;
}
