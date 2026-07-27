import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ListStaffQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListStaffQueryDto
  extends PaginationQueryDto
  implements ListStaffQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}
