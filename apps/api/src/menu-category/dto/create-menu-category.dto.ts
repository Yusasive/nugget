import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import type { CreateMenuCategoryRequestBody } from '@nugget/shared-types';

export class CreateMenuCategoryDto implements CreateMenuCategoryRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
