import { IsEnum } from 'class-validator';
import {
  KITCHEN_ITEM_STATUSES,
  type KitchenItemStatus,
  type UpdateKitchenItemStatusRequestBody,
} from '@nugget/shared-types';

export class UpdateKitchenItemStatusDto implements UpdateKitchenItemStatusRequestBody {
  @IsEnum(KITCHEN_ITEM_STATUSES)
  status: KitchenItemStatus;
}
