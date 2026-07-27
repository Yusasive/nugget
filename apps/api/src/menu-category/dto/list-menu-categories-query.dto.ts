import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListMenuCategoriesQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListMenuCategoriesQueryDto
  extends PaginationQueryDto
  implements ListMenuCategoriesQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
