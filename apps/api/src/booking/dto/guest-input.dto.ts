import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type { GuestInput } from '@nugget/shared-types';

export class GuestInputDto implements GuestInput {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
