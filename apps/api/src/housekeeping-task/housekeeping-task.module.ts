import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HousekeepingTaskController } from './housekeeping-task.controller';
import { HousekeepingTaskService } from './housekeeping-task.service';

@Module({
  imports: [AuthModule],
  controllers: [HousekeepingTaskController],
  providers: [HousekeepingTaskService],
})
export class HousekeepingTaskModule {}
