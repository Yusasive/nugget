import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import type { ListCashReportsQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCashReportsQueryDto
  extends PaginationQueryDto
  implements ListCashReportsQuery
{
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsDateString()
  closedFrom?: string;

  @IsOptional()
  @IsDateString()
  closedTo?: string;
}
