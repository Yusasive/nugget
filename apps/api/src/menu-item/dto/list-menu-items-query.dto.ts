import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ListMenuItemsQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListMenuItemsQueryDto
  extends PaginationQueryDto
  implements ListMenuItemsQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isAvailable?: boolean;
}
