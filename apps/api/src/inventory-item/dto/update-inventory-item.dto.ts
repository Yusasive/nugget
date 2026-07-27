import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import type { UpdateInventoryItemRequestBody } from '@nugget/shared-types';

const DECIMAL_PATTERN = /^\d+(\.\d{1,3})?$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class UpdateInventoryItemDto implements UpdateInventoryItemRequestBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;

  @IsOptional()
  @Matches(DECIMAL_PATTERN, {
    message: 'reorderThreshold must look like "10" or "10.500"',
  })
  reorderThreshold?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN, { message: 'unitCost must look like "10" or "10.00"' })
  unitCost?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
