import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  SHIFT_STATUSES,
  type ListShiftsQuery,
  type ShiftStatus,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListShiftsQueryDto
  extends PaginationQueryDto
  implements ListShiftsQuery
{
  @IsOptional()
  @IsEnum(SHIFT_STATUSES)
  status?: ShiftStatus;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsDateString()
  openedFrom?: string;

  @IsOptional()
  @IsDateString()
  openedTo?: string;
}
