import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  HOUSEKEEPING_TASK_STATUSES,
  type HousekeepingTaskStatus,
  type UpdateHousekeepingTaskRequestBody,
} from '@nugget/shared-types';

export class UpdateHousekeepingTaskDto
  implements UpdateHousekeepingTaskRequestBody
{
  @IsOptional()
  @IsUUID()
  assignedToStaffId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HOUSEKEEPING_TASK_STATUSES)
  status?: HousekeepingTaskStatus;
}
