import { IsString, MinLength } from 'class-validator';
import type { ChangePasswordRequestBody } from '@nugget/shared-types';

export class ChangePasswordDto implements ChangePasswordRequestBody {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
