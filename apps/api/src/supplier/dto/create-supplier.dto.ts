import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import type { CreateSupplierRequestBody } from '@nugget/shared-types';

export class CreateSupplierDto implements CreateSupplierRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  contactNotes?: string;
}
