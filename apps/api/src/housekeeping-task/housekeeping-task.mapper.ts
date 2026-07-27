import type { HousekeepingTaskDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const HOUSEKEEPING_TASK_INCLUDE = {
  room: true,
  assignedToStaff: true,
} as const;

export type HousekeepingTaskWithRelations = Prisma.HousekeepingTaskGetPayload<{
  include: typeof HOUSEKEEPING_TASK_INCLUDE;
}>;

export function toHousekeepingTaskDto(
  task: HousekeepingTaskWithRelations,
): HousekeepingTaskDto {
  return {
    id: task.id,
    branchId: task.branchId,
    room: { id: task.room.id, roomNumber: task.room.roomNumber },
    assignedToStaff: task.assignedToStaff
      ? {
          id: task.assignedToStaff.id,
          firstName: task.assignedToStaff.firstName,
          lastName: task.assignedToStaff.lastName,
        }
      : null,
    description: task.description,
    status: task.status,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
