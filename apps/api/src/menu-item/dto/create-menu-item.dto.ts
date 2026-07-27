import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import type { CreateMenuItemRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateMenuItemDto implements CreateMenuItemRequestBody {
  @IsUUID()
  branchId: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Matches(MONEY_PATTERN, {
    message: 'price must look like "120" or "120.00"',
  })
  price: string;
}
