import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  RESTAURANT_TABLE_STATUSES,
  type ListRestaurantTablesQuery,
  type RestaurantTableStatus,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListRestaurantTablesQueryDto
  extends PaginationQueryDto
  implements ListRestaurantTablesQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(RESTAURANT_TABLE_STATUSES)
  status?: RestaurantTableStatus;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
