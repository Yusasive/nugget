import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import {
  RATE_PLAN_TYPES,
  type RatePlanType,
  type UpdateRatePlanRequestBody,
} from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class UpdateRatePlanDto implements UpdateRatePlanRequestBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(RATE_PLAN_TYPES)
  type?: RatePlanType;

  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: 'pricePerNight must look like "120" or "120.00"',
  })
  pricePerNight?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
