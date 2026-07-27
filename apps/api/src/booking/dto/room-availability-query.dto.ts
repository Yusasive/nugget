import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import type { RoomAvailabilityQuery } from '@nugget/shared-types';

export class RoomAvailabilityQueryDto implements RoomAvailabilityQuery {
  @IsUUID()
  branchId: string;

  @IsDateString()
  checkInDate: string;

  @IsDateString()
  checkOutDate: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
}
