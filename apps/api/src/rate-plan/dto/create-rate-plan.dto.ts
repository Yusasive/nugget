import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import {
  RATE_PLAN_TYPES,
  type CreateRatePlanRequestBody,
  type RatePlanType,
} from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateRatePlanDto implements CreateRatePlanRequestBody {
  @IsUUID()
  roomTypeId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(RATE_PLAN_TYPES)
  type: RatePlanType;

  @Matches(MONEY_PATTERN, {
    message: 'pricePerNight must look like "120" or "120.00"',
  })
  pricePerNight: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}
