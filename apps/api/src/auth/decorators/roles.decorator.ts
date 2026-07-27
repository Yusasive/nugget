import { SetMetadata } from '@nestjs/common';
import type { StaffRoleName } from '@nugget/shared-types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: StaffRoleName[]) =>
  SetMetadata(ROLES_KEY, roles);
