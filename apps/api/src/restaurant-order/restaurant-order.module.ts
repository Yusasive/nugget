import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { RestaurantOrderController } from './restaurant-order.controller';
import { RestaurantOrderService } from './restaurant-order.service';

@Module({
  imports: [AuthModule, AuditModule, BillingModule],
  controllers: [RestaurantOrderController],
  providers: [RestaurantOrderService],
})
export class RestaurantOrderModule {}
