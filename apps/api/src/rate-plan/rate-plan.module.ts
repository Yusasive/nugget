import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RatePlanController } from './rate-plan.controller';
import { RatePlanService } from './rate-plan.service';

@Module({
  imports: [AuthModule],
  controllers: [RatePlanController],
  providers: [RatePlanService],
  exports: [RatePlanService],
})
export class RatePlanModule {}
