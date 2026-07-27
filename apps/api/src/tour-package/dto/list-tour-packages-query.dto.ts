import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListTourPackagesQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListTourPackagesQueryDto
  extends PaginationQueryDto
  implements ListTourPackagesQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
