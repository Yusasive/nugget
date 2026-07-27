import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TourGuideController } from './tour-guide.controller';
import { TourGuideService } from './tour-guide.service';

@Module({
  imports: [AuthModule],
  controllers: [TourGuideController],
  providers: [TourGuideService],
  exports: [TourGuideService],
})
export class TourGuideModule {}
