import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  RESTAURANT_ORDER_TYPES,
  type CreateRestaurantOrderRequestBody,
  type RestaurantOrderType,
} from '@nugget/shared-types';

export class CreateRestaurantOrderDto implements CreateRestaurantOrderRequestBody {
  @IsEnum(RESTAURANT_ORDER_TYPES)
  orderType: RestaurantOrderType;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsUUID()
  roomBookingId?: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;
}
