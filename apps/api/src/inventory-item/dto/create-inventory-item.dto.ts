import { IsString, IsUUID, Matches, MinLength } from 'class-validator';
import type { CreateInventoryItemRequestBody } from '@nugget/shared-types';

const DECIMAL_PATTERN = /^\d+(\.\d{1,3})?$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateInventoryItemDto implements CreateInventoryItemRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(1)
  unit: string;

  @Matches(DECIMAL_PATTERN, {
    message: 'reorderThreshold must look like "10" or "10.500"',
  })
  reorderThreshold: string;

  @Matches(MONEY_PATTERN, {
    message: 'unitCost must look like "10" or "10.00"',
  })
  unitCost: string;
}
