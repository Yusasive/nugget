import type { StaffRoleName } from '@nugget/shared-types';

export interface JwtPayload {
  sub: string;
  role: StaffRoleName;
  branchId: string;
}
