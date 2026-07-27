import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ListAuditLogQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAuditLogQueryDto
  extends PaginationQueryDto
  implements ListAuditLogQuery
{
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
