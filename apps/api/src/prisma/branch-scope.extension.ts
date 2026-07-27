import { ClsService } from 'nestjs-cls';
import type { AppClsStore } from '../context/app-cls-store';
import { PrismaService } from './prisma.service';

/**
 * Models that carry a branchId and must never leak across branches.
 * Add to this set as new modules introduce branch-scoped tables — this is
 * the one place that decision needs to be made (TRD §3.7).
 */
const BRANCH_SCOPED_MODELS = new Set([
  'Department',
  'Staff',
  'AuditLog',
  'RoomType',
  'Room',
  'RatePlan',
  'Booking',
  'RoomTransfer',
  'Shift',
  'ShiftTransaction',
  'CashReport',
  'FolioCharge',
  'Invoice',
  'Payment',
  'Refund',
  'TourGuide',
  'Vehicle',
  'TourPackage',
  'TourDeparture',
  'TourBooking',
  'MenuCategory',
  'MenuItem',
  'RestaurantTable',
  'RestaurantOrder',
  'OrderItem',
  'Supplier',
  'InventoryItem',
  'StockMovement',
  'PurchaseRecord',
  'Expense',
  // ExpenseCategory's branchId is nullable in the schema (TRD §3.5 allows
  // company-wide default categories), but Milestone 8/9 don't create any
  // null-branch rows yet — every category, including the "Restaurant
  // Purchases" default PurchaseRecordService auto-creates, is per-branch in
  // practice. Scoping it here like every other catalog table is safe as
  // long as that holds; a real global-defaults feature would need to leave
  // this out and filter manually instead (forcing branchId onto every
  // operation would hide null-branch rows from non-Super-Admin roles).
  'ExpenseCategory',
  // Milestone 10
  'HousekeepingTask',
  // Milestone 11
  'Attendance',
]);

const OPERATIONS_WITH_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
  'upsert',
]);

/**
 * Forces branchId everywhere it matters for a given operation, regardless of
 * what the caller passed in. Merging it last (rather than only filling it in
 * when absent) is deliberate: a controller bug that lets a non-Super-Admin
 * supply a foreign branchId must not be able to read or write across
 * branches just because the Prisma call happened to include one.
 */
type UnknownRecord = Record<string, unknown>;

function withBranchId(value: unknown, branchId: string): UnknownRecord {
  return { ...((value as UnknownRecord | undefined) ?? {}), branchId };
}

export function applyBranchScope(
  operation: string,
  rawArgs: unknown,
  branchId: string,
): UnknownRecord {
  const args: UnknownRecord = {
    ...((rawArgs as UnknownRecord | undefined) ?? {}),
  };

  switch (operation) {
    case 'create':
    case 'update':
    case 'updateMany':
      args.data = withBranchId(args.data, branchId);
      break;
    case 'createMany':
      args.data = Array.isArray(args.data)
        ? args.data.map((item) => withBranchId(item, branchId))
        : withBranchId(args.data, branchId);
      break;
    case 'upsert':
      args.create = withBranchId(args.create, branchId);
      args.update = withBranchId(args.update, branchId);
      break;
  }

  if (OPERATIONS_WITH_WHERE.has(operation)) {
    args.where = withBranchId(args.where, branchId);
  }

  return args;
}

export function createScopedPrismaClient(
  prisma: PrismaService,
  cls: ClsService<AppClsStore>,
) {
  return prisma.$extends({
    name: 'branch-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const actor = cls.get('actor');

          // No actor (system/seed context) or Super Admin (cross-branch by
          // design) or a model that isn't branch-scoped: pass through as-is.
          if (
            !actor ||
            actor.role === 'SUPER_ADMIN' ||
            !BRANCH_SCOPED_MODELS.has(model)
          ) {
            return query(args);
          }

          return query(applyBranchScope(operation, args, actor.branchId));
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof createScopedPrismaClient>;

export const SCOPED_PRISMA = Symbol('SCOPED_PRISMA');
