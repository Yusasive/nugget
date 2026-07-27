import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class InventoryReportQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['csv'])
  format?: string;
}
