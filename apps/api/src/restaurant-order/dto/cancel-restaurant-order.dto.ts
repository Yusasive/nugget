import { IsOptional, IsString } from 'class-validator';
import type { CancelRestaurantOrderRequestBody } from '@nugget/shared-types';

export class CancelRestaurantOrderDto implements CancelRestaurantOrderRequestBody {
  @IsOptional()
  @IsString()
  reason?: string;
}
