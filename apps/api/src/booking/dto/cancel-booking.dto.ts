import { IsOptional, IsString } from 'class-validator';
import type { CancelBookingRequestBody } from '@nugget/shared-types';

export class CancelBookingDto implements CancelBookingRequestBody {
  @IsOptional()
  @IsString()
  reason?: string;
}
