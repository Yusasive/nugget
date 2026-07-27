import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';
import type { SetRoomOutOfOrderRequestBody } from '@nugget/shared-types';

export class SetRoomOutOfOrderDto implements SetRoomOutOfOrderRequestBody {
  @IsBoolean()
  isOutOfOrder: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
