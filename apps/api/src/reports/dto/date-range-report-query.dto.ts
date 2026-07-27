import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import type { DateRangeReportQuery } from '@nugget/shared-types';

export class DateRangeReportQueryDto implements DateRangeReportQuery {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Read directly by the controller via `@Query('format')` — declared
   * here too so the global ValidationPipe's forbidNonWhitelisted doesn't
   * reject it as an unknown property of the query object. */
  @IsOptional()
  @IsIn(['csv'])
  format?: string;
}
