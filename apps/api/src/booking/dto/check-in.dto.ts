import { IsOptional, IsUUID, Matches } from 'class-validator';
import type { CheckInRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CheckInDto implements CheckInRequestBody {
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: 'depositAmount must look like "50" or "50.00"',
  })
  depositAmount?: string;
}
