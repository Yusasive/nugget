import { IsString } from 'class-validator';
import type { RefreshRequestBody } from '@nugget/shared-types';

export class RefreshDto implements RefreshRequestBody {
  @IsString()
  refreshToken: string;
}
