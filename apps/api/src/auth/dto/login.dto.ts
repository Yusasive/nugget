import { IsEmail, IsString, MinLength } from 'class-validator';
import type { LoginRequestBody } from '@nugget/shared-types';

export class LoginDto implements LoginRequestBody {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
