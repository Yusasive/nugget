import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListTourGuidesQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListTourGuidesQueryDto
  extends PaginationQueryDto
  implements ListTourGuidesQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
