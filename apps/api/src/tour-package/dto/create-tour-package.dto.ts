import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import type { CreateTourPackageRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateTourPackageDto implements CreateTourPackageRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  itinerary?: string;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  @Matches(MONEY_PATTERN, {
    message: 'defaultPricePerSeat must look like "50" or "50.00"',
  })
  defaultPricePerSeat: string;

  @IsInt()
  @Min(1)
  defaultCapacity: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
