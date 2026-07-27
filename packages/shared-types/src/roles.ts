export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "BRANCH_MANAGER",
  "FRONT_DESK",
  "HOUSEKEEPING",
  "ACCOUNTANT",
  "TOURS_COORDINATOR",
  "RESTAURANT_STAFF",
] as const;

export type StaffRoleName = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRoleName, string> = {
  SUPER_ADMIN: "Super Admin",
  BRANCH_MANAGER: "Branch Manager",
  FRONT_DESK: "Front Desk",
  HOUSEKEEPING: "Housekeeping",
  ACCOUNTANT: "Accountant",
  TOURS_COORDINATOR: "Tours Coordinator",
  RESTAURANT_STAFF: "Restaurant Staff",
};
