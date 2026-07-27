import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import type { UpdateDepartmentRequestBody } from '@nugget/shared-types';

export class UpdateDepartmentDto implements UpdateDepartmentRequestBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
