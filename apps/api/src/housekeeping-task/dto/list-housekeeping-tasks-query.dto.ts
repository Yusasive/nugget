import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  HOUSEKEEPING_TASK_STATUSES,
  type HousekeepingTaskStatus,
  type ListHousekeepingTasksQuery,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListHousekeepingTasksQueryDto
  extends PaginationQueryDto
  implements ListHousekeepingTasksQuery
{
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsEnum(HOUSEKEEPING_TASK_STATUSES)
  status?: HousekeepingTaskStatus;
}
