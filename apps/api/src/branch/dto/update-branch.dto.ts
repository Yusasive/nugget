import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import type { UpdateBranchRequestBody } from '@nugget/shared-types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class UpdateBranchDto implements UpdateBranchRequestBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: 'standardCheckInTime must be "HH:mm" 24h, e.g. "14:00"',
  })
  standardCheckInTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: 'standardCheckOutTime must be "HH:mm" 24h, e.g. "12:00"',
  })
  standardCheckOutTime?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: 'earlyCheckInFeeAmount must look like "50" or "50.00"',
  })
  earlyCheckInFeeAmount?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: 'lateCheckOutFeeAmount must look like "50" or "50.00"',
  })
  lateCheckOutFeeAmount?: string;
}
