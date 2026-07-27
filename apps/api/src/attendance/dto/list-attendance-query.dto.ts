import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import type { ListAttendanceQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAttendanceQueryDto
  extends PaginationQueryDto
  implements ListAttendanceQuery
{
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
