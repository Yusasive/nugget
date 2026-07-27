import type { StaffDto, StaffRoleName } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export type StaffWithRelations = Prisma.StaffGetPayload<{
  include: { role: true; branch: true; department: true };
}>;

export function toStaffDto(staff: StaffWithRelations): StaffDto {
  return {
    id: staff.id,
    branchId: staff.branchId,
    email: staff.email,
    firstName: staff.firstName,
    lastName: staff.lastName,
    phone: staff.phone,
    isActive: staff.isActive,
    lastLoginAt: staff.lastLoginAt ? staff.lastLoginAt.toISOString() : null,
    createdAt: staff.createdAt.toISOString(),
    role: {
      id: staff.role.id,
      name: staff.role.name as StaffRoleName,
      label: staff.role.label,
    },
    branch: { id: staff.branch.id, name: staff.branch.name },
    department: staff.department
      ? { id: staff.department.id, name: staff.department.name }
      : null,
  };
}
