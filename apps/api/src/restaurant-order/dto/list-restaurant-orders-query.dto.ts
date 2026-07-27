import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  RESTAURANT_ORDER_STATUSES,
  RESTAURANT_ORDER_TYPES,
  type ListRestaurantOrdersQuery,
  type RestaurantOrderStatus,
  type RestaurantOrderType,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListRestaurantOrdersQueryDto
  extends PaginationQueryDto
  implements ListRestaurantOrdersQuery
{
  @IsOptional()
  @IsEnum(RESTAURANT_ORDER_STATUSES)
  status?: RestaurantOrderStatus;

  @IsOptional()
  @IsEnum(RESTAURANT_ORDER_TYPES)
  orderType?: RestaurantOrderType;

  @IsOptional()
  @IsUUID()
  tableId?: string;
}
