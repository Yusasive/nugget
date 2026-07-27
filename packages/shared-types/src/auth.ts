import type { StaffRoleName } from "./roles";

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface RefreshRequestBody {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedStaff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRoleName;
  branchId: string;
  branchName: string;
  departmentId: string | null;
}

export interface LoginResponse extends AuthTokens {
  staff: AuthenticatedStaff;
}
