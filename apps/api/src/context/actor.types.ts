import type { StaffRoleName } from '@nugget/shared-types';

/** Identity carried on every authenticated request, sourced from the JWT payload. */
export interface ActorContext {
  staffId: string;
  role: StaffRoleName;
  branchId: string;
}
