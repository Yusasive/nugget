import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { TourPackageModule } from '../tour-package/tour-package.module';
import { PublicTourController } from './public-tour.controller';
import { TourBookingController } from './tour-booking.controller';
import { TourBookingService } from './tour-booking.service';
import { TourDepartureController } from './tour-departure.controller';
import { TourDepartureService } from './tour-departure.service';

@Module({
  imports: [AuthModule, AuditModule, TourPackageModule, BillingModule],
  controllers: [
    TourDepartureController,
    TourBookingController,
    PublicTourController,
  ],
  providers: [TourDepartureService, TourBookingService],
})
export class TourModule {}
