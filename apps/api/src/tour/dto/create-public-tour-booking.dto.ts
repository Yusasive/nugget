import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import type { CreatePublicTourBookingRequestBody } from '@nugget/shared-types';
import { GuestInputDto } from '../../booking/dto/guest-input.dto';

export class CreatePublicTourBookingDto
  implements CreatePublicTourBookingRequestBody
{
  @IsUUID()
  branchId: string;

  @IsUUID()
  tourDepartureId: string;

  @IsInt()
  @Min(1)
  seats: number;

  @ValidateNested()
  @Type(() => GuestInputDto)
  guest: GuestInputDto;

  @IsOptional()
  @IsUUID()
  linkedBookingId?: string;
}
