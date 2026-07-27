import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListInventoryItemsQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListInventoryItemsQueryDto
  extends PaginationQueryDto
  implements ListInventoryItemsQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  lowStockOnly?: boolean;
}
