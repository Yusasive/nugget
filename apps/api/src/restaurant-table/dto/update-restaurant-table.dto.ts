import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import type { UpdateRestaurantTableRequestBody } from '@nugget/shared-types';

export class UpdateRestaurantTableDto implements UpdateRestaurantTableRequestBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  tableNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
