import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';
import type { UpdateGuestRequestBody } from '@nugget/shared-types';

export class UpdateGuestDto implements UpdateGuestRequestBody {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  preferences?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @IsOptional()
  @IsBoolean()
  isBlacklisted?: boolean;
}
