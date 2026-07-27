import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListBranchesQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListBranchesQueryDto
  extends PaginationQueryDto
  implements ListBranchesQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
