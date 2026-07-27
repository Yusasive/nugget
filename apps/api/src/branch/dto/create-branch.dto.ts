import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type { CreateBranchRequestBody } from '@nugget/shared-types';

export class CreateBranchDto implements CreateBranchRequestBody {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
