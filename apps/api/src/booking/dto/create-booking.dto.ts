import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import type { CreateBookingRequestBody } from '@nugget/shared-types';
import { GuestInputDto } from './guest-input.dto';

export class CreateBookingDto implements CreateBookingRequestBody {
  @IsUUID()
  roomId: string;

  @IsUUID()
  ratePlanId: string;

  @IsDateString()
  checkInDate: string;

  @IsDateString()
  checkOutDate: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInputDto)
  guest?: GuestInputDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
