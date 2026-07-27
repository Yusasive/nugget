import { IsString, IsUUID, MinLength } from 'class-validator';
import type { CreateExpenseCategoryRequestBody } from '@nugget/shared-types';

export class CreateExpenseCategoryDto implements CreateExpenseCategoryRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  name: string;
}
