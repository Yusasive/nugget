import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import type { CreateVehicleRequestBody } from '@nugget/shared-types';

export class CreateVehicleDto implements CreateVehicleRequestBody {
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsInt()
  @Min(1)
  capacity: number;
}
