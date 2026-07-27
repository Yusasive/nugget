import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import type { PaginationQuery } from '@nugget/shared-types';

export class PaginationQueryDto implements PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
