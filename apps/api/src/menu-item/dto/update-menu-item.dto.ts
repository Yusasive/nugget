import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import type { UpdateMenuItemRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class UpdateMenuItemDto implements UpdateMenuItemRequestBody {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: 'price must look like "120" or "120.00"',
  })
  price?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
