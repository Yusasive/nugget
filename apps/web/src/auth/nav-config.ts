import type { StaffRoleName } from '@nugget/shared-types';

export interface NavItem {
  label: string;
  path: string;
  roles: StaffRoleName[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Nav visibility only — the API enforces the real boundary (see the
 * @Roles guards). Anything hidden here is still rejected server-side if
 * called directly, per PRD §5.15.
 *
 * Modules from later milestones are intentionally absent rather than
 * stubbed: an empty screen behind a nav item is worse than no nav item.
 *
 * Dashboard sits outside any section — it's the one link every role has,
 * so it stays a flat top-level link rather than living inside a collapsed
 * group a new session might not think to open.
 */
export const DASHBOARD_ITEM: NavItem = {
  label: 'Dashboard',
  path: '/app',
  roles: [
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'FRONT_DESK',
    'HOUSEKEEPING',
    'ACCOUNTANT',
    'TOURS_COORDINATOR',
    'RESTAURANT_STAFF',
  ],
};

/** Self-service profile (see ProfilePage.tsx) — every role has one, so it
 * sits next to Dashboard as a flat top-level link rather than inside a
 * module section. The account footer's name link still goes here too;
 * this is what makes it discoverable without knowing that. */
export const PROFILE_ITEM: NavItem = {
  label: 'My Profile',
  path: '/app/profile',
  roles: [
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'FRONT_DESK',
    'HOUSEKEEPING',
    'ACCOUNTANT',
    'TOURS_COORDINATOR',
    'RESTAURANT_STAFF',
  ],
};

/**
 * Everything else groups into collapsible sections (AppShell renders each
 * as a <details>/<summary> disclosure) — a flat 20+ item list was the thing
 * being fixed here, so keep new items inside the section they best fit
 * rather than growing a new top-level entry.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Front Desk & Rooms',
    items: [
      { label: 'Front Desk', path: '/app/front-desk', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'] },
      { label: 'Bookings', path: '/app/bookings', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT'] },
      { label: 'Rooms', path: '/app/rooms', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK'] },
      { label: 'Room Types', path: '/app/room-types', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK'] },
      { label: 'Shift', path: '/app/shift', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK'] },
      { label: 'Cash Reports', path: '/app/cash-reports', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT'] },
      { label: 'Guests', path: '/app/guests', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT'] },
      { label: 'Housekeeping', path: '/app/housekeeping', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'] },
    ],
  },
  {
    label: 'Tours',
    items: [
      { label: 'Tour Catalog', path: '/app/tour-catalog', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR'] },
      { label: 'Tour Departures', path: '/app/tour-departures', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR'] },
      { label: 'Tour Bookings', path: '/app/tour-bookings', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR'] },
    ],
  },
  {
    label: 'Restaurant',
    items: [
      { label: 'Menu', path: '/app/menu', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF'] },
      { label: 'Tables', path: '/app/tables', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF'] },
      { label: 'Orders', path: '/app/orders', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF'] },
      // Kitchen Display is deliberately absent here — it's a no-chrome surface
      // reached by direct link/bookmark on the mounted kitchen tablet, the
      // same reasoning the guest site isn't in the staff nav either
      // (ui-ux.md §7.2).
    ],
  },
  {
    label: 'Inventory & Purchasing',
    items: [
      { label: 'Inventory', path: '/app/inventory', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF'] },
      { label: 'Suppliers', path: '/app/suppliers', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF'] },
      { label: 'Purchases', path: '/app/purchases', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF'] },
    ],
  },
  {
    label: 'Finance & Reports',
    items: [
      { label: 'Expenses', path: '/app/expenses', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK', 'RESTAURANT_STAFF'] },
      { label: 'Reports', path: '/app/reports', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF'] },
      { label: 'Audit Log', path: '/app/audit-log', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Branches', path: '/app/branches', roles: ['SUPER_ADMIN'] },
      { label: 'Staff', path: '/app/staff', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Departments', path: '/app/departments', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Attendance', path: '/app/attendance', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING', 'ACCOUNTANT', 'TOURS_COORDINATOR', 'RESTAURANT_STAFF'] },
      { label: 'Settings', path: '/app/settings', roles: ['SUPER_ADMIN'] },
    ],
  },
];

export function navSectionsForRole(role: StaffRoleName): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
