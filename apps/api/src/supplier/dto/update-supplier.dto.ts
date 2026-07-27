import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import type { UpdateSupplierRequestBody } from '@nugget/shared-types';

export class UpdateSupplierDto implements UpdateSupplierRequestBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  contactNotes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
