import { IsString, IsUUID, MinLength } from 'class-validator';
import type { CreateDepartmentRequestBody } from '@nugget/shared-types';

export class CreateDepartmentDto implements CreateDepartmentRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  name: string;
}
