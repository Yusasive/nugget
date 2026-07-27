import type { PaginationQuery } from "./pagination";
import type { StaffRoleName } from "./roles";

export interface ListStaffQuery extends PaginationQuery {
  search?: string;
  roleId?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface RoleDto {
  id: string;
  name: StaffRoleName;
  label: string;
}

export interface DepartmentDto {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

export interface StaffDto {
  id: string;
  branchId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: RoleDto;
  branch: { id: string; name: string };
  department: { id: string; name: string } | null;
}

export interface CreateStaffRequestBody {
  branchId: string;
  roleId: string;
  departmentId?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UpdateStaffRequestBody {
  roleId?: string;
  departmentId?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

/** Self-service profile edit — deliberately narrower than
 * UpdateStaffRequestBody: no roleId/departmentId/isActive, so a staff
 * member editing their own profile can never grant themselves a role or
 * reactivate themselves. */
export interface UpdateOwnProfileRequestBody {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ChangePasswordRequestBody {
  currentPassword: string;
  newPassword: string;
}

export interface CreateDepartmentRequestBody {
  branchId: string;
  name: string;
}

export interface UpdateDepartmentRequestBody {
  name?: string;
  isActive?: boolean;
}
