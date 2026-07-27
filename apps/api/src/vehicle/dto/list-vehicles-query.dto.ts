import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListVehiclesQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListVehiclesQueryDto
  extends PaginationQueryDto
  implements ListVehiclesQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
