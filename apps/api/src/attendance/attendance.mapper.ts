import type { AttendanceDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const ATTENDANCE_INCLUDE = {
  staff: { include: { department: true } },
} as const;

export type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  include: typeof ATTENDANCE_INCLUDE;
}>;

export function toAttendanceDto(
  attendance: AttendanceWithRelations,
): AttendanceDto {
  return {
    id: attendance.id,
    branchId: attendance.branchId,
    staff: {
      id: attendance.staff.id,
      firstName: attendance.staff.firstName,
      lastName: attendance.staff.lastName,
    },
    department: attendance.staff.department
      ? {
          id: attendance.staff.department.id,
          name: attendance.staff.department.name,
        }
      : null,
    clockIn: attendance.clockIn.toISOString(),
    clockOut: attendance.clockOut ? attendance.clockOut.toISOString() : null,
    date: attendance.date.toISOString(),
  };
}
