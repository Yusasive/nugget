import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import type { CreateStaffRequestBody } from '@nugget/shared-types';

export class CreateStaffDto implements CreateStaffRequestBody {
  @IsUUID()
  branchId: string;

  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;
}
