import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import type { ProfitAndLossQuery } from '@nugget/shared-types';

export class ProfitAndLossQueryDto implements ProfitAndLossQuery {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must look like "2026-07"',
  })
  month: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['csv', 'pdf'])
  format?: string;
}
