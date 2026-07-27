import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import type { CreateTourDepartureRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateTourDepartureDto implements CreateTourDepartureRequestBody {
  @IsUUID()
  tourPackageId: string;

  @IsUUID()
  guideId: string;

  @IsUUID()
  vehicleId: string;

  @IsDateString()
  departureAt: string;

  @IsDateString()
  returnAt: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @Matches(MONEY_PATTERN, {
    message: 'pricePerSeat must look like "50" or "50.00"',
  })
  pricePerSeat?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
