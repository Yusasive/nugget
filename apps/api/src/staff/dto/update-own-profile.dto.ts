import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import type { UpdateOwnProfileRequestBody } from '@nugget/shared-types';

const PHONE_PATTERN = /^[0-9+()\-\s]{6,20}$/;

export class UpdateOwnProfileDto implements UpdateOwnProfileRequestBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @Matches(PHONE_PATTERN, {
    message: 'phone must be 6-20 characters of digits, spaces, +, -, ( or )',
  })
  phone?: string;
}
