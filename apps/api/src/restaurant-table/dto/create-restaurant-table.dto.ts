import { IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';
import type { CreateRestaurantTableRequestBody } from '@nugget/shared-types';

export class CreateRestaurantTableDto
  implements CreateRestaurantTableRequestBody
{
  @IsUUID()
  branchId: string;

  @IsString()
  @MinLength(1)
  tableNumber: string;

  @IsInt()
  @Min(1)
  capacity: number;
}
