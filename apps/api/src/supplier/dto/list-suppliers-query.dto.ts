import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListSuppliersQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListSuppliersQueryDto
  extends PaginationQueryDto
  implements ListSuppliersQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
