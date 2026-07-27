import type { PaginationQuery } from "./pagination";

/** PRD §5.13 attendance tracking: clock-in/clock-out per staff member per
 * shift. `date` groups records into "a day's attendance record" (M11 DoD)
 * independent of which calendar day clockOut happens to fall on for an
 * overnight shift. */
export interface AttendanceDto {
  id: string;
  branchId: string;
  staff: { id: string; firstName: string; lastName: string };
  department: { id: string; name: string } | null;
  clockIn: string;
  clockOut: string | null;
  date: string;
}

export interface ListAttendanceQuery extends PaginationQuery {
  staffId?: string;
  departmentId?: string;
  /** Date-only (YYYY-MM-DD); defaults to today when omitted. */
  date?: string;
  /** Only takes effect for Super Admin — every other role is force-scoped to their own branch server-side. */
  branchId?: string;
}
