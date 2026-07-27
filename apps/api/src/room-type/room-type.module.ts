import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomTypeController } from './room-type.controller';
import { RoomTypeService } from './room-type.service';

@Module({
  imports: [AuthModule],
  controllers: [RoomTypeController],
  providers: [RoomTypeService],
  exports: [RoomTypeService],
})
export class RoomTypeModule {}
