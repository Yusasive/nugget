import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import type { CreateTourGuideRequestBody } from '@nugget/shared-types';

export class CreateTourGuideDto implements CreateTourGuideRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
