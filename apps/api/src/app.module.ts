import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { BranchModule } from './branch/branch.module';
import { RoleModule } from './role/role.module';
import { DepartmentModule } from './department/department.module';
import { StaffModule } from './staff/staff.module';
import { RoomTypeModule } from './room-type/room-type.module';
import { RoomModule } from './room/room.module';
import { RatePlanModule } from './rate-plan/rate-plan.module';
import { BookingModule } from './booking/booking.module';
import { ShiftModule } from './shift/shift.module';
import { BillingModule } from './billing/billing.module';
import { TourGuideModule } from './tour-guide/tour-guide.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { TourPackageModule } from './tour-package/tour-package.module';
import { TourModule } from './tour/tour.module';
import { MenuCategoryModule } from './menu-category/menu-category.module';
import { MenuItemModule } from './menu-item/menu-item.module';
import { RestaurantTableModule } from './restaurant-table/restaurant-table.module';
import { RestaurantOrderModule } from './restaurant-order/restaurant-order.module';
import { SupplierModule } from './supplier/supplier.module';
import { InventoryItemModule } from './inventory-item/inventory-item.module';
import { ExpenseCategoryModule } from './expense-category/expense-category.module';
import { ExpenseModule } from './expense/expense.module';
import { PurchaseRecordModule } from './purchase-record/purchase-record.module';
import { GuestModule } from './guest/guest.module';
import { HousekeepingTaskModule } from './housekeeping-task/housekeeping-task.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // Global rate limiter — 60 requests per minute per IP by default.
    // Auth endpoints apply a stricter 10/minute limit via @Throttle() on
    // the controller (brute-force protection for login/refresh).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    AuditModule,
    BranchModule,
    RoleModule,
    DepartmentModule,
    StaffModule,
    RoomTypeModule,
    RoomModule,
    RatePlanModule,
    BookingModule,
    ShiftModule,
    BillingModule,
    TourGuideModule,
    VehicleModule,
    TourPackageModule,
    TourModule,
    MenuCategoryModule,
    MenuItemModule,
    RestaurantTableModule,
    RestaurantOrderModule,
    SupplierModule,
    InventoryItemModule,
    ExpenseCategoryModule,
    ExpenseModule,
    PurchaseRecordModule,
    GuestModule,
    HousekeepingTaskModule,
    AttendanceModule,
    AuditLogModule,
    ReportsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
