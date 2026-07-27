import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { ListRoomTypesQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListRoomTypesQueryDto
  extends PaginationQueryDto
  implements ListRoomTypesQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
