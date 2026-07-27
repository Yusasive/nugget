import { IsEnum } from 'class-validator';
import {
  HOUSEKEEPING_STATUSES,
  type HousekeepingStatus,
  type SetRoomHousekeepingStatusRequestBody,
} from '@nugget/shared-types';

export class SetHousekeepingStatusDto implements SetRoomHousekeepingStatusRequestBody {
  @IsEnum(HOUSEKEEPING_STATUSES)
  housekeepingStatus: HousekeepingStatus;
}
