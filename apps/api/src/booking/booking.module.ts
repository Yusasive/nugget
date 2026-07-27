import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RatePlanModule } from '../rate-plan/rate-plan.module';
import { RoomTypeModule } from '../room-type/room-type.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { PublicBookingController } from './public-booking.controller';

@Module({
  imports: [AuthModule, AuditModule, RoomTypeModule, RatePlanModule],
  controllers: [BookingController, PublicBookingController],
  providers: [BookingService],
})
export class BookingModule {}
