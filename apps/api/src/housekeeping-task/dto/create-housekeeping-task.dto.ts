import { IsOptional, IsString, IsUUID } from 'class-validator';
import type { CreateHousekeepingTaskRequestBody } from '@nugget/shared-types';

export class CreateHousekeepingTaskDto implements CreateHousekeepingTaskRequestBody {
  @IsUUID()
  branchId: string;

  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsUUID()
  assignedToStaffId?: string;

  @IsString()
  description: string;
}
