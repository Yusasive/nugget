import { IsEnum } from 'class-validator';
import {
  RESTAURANT_TABLE_STATUSES,
  type RestaurantTableStatus,
  type SetRestaurantTableStatusRequestBody,
} from '@nugget/shared-types';

export class SetRestaurantTableStatusDto
  implements SetRestaurantTableStatusRequestBody
{
  @IsEnum(RESTAURANT_TABLE_STATUSES)
  status: RestaurantTableStatus;
}
