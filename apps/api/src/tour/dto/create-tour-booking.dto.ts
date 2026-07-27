import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CreateTourBookingRequestBody } from '@nugget/shared-types';
import { GuestInputDto } from '../../booking/dto/guest-input.dto';

export class CreateTourBookingDto implements CreateTourBookingRequestBody {
  @IsUUID()
  tourDepartureId: string;

  @IsInt()
  @Min(1)
  seats: number;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInputDto)
  guest?: GuestInputDto;

  @IsOptional()
  @IsUUID()
  linkedBookingId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
