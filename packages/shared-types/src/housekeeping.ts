import type { PaginationQuery } from './pagination';

export const HOUSEKEEPING_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;
export type HousekeepingTaskStatus = (typeof HOUSEKEEPING_TASK_STATUSES)[number];

export interface HousekeepingTaskDto {
  id: string;
  branchId: string;
  room: { id: string; roomNumber: string };
  assignedToStaff: { id: string; firstName: string; lastName: string } | null;
  description: string;
  status: HousekeepingTaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHousekeepingTaskRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch. */
  branchId: string;
  roomId: string;
  assignedToStaffId?: string;
  description: string;
}

export interface UpdateHousekeepingTaskRequestBody {
  assignedToStaffId?: string | null;
  description?: string;
  status?: HousekeepingTaskStatus;
}

export interface ListHousekeepingTasksQuery extends PaginationQuery {
  roomId?: string;
  status?: HousekeepingTaskStatus;
}
