import { Type } from 'class-transformer';
import { IsDateString, IsUUID, ValidateNested } from 'class-validator';
import type { CreatePublicBookingRequestBody } from '@nugget/shared-types';
import { GuestInputDto } from './guest-input.dto';

export class CreatePublicBookingDto implements CreatePublicBookingRequestBody {
  @IsUUID()
  branchId: string;

  @IsUUID()
  roomId: string;

  @IsUUID()
  ratePlanId: string;

  @IsDateString()
  checkInDate: string;

  @IsDateString()
  checkOutDate: string;

  @ValidateNested()
  @Type(() => GuestInputDto)
  guest: GuestInputDto;
}
