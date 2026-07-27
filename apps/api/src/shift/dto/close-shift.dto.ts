import { IsOptional, IsString, Matches } from 'class-validator';
import type { CloseShiftRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CloseShiftDto implements CloseShiftRequestBody {
  @Matches(MONEY_PATTERN, {
    message: 'closingCashActual must look like "50" or "50.00"',
  })
  closingCashActual: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
