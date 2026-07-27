import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomController } from './room.controller';
import { RoomStatusBoardService } from './room-status-board.service';
import { RoomService } from './room.service';

@Module({
  imports: [AuthModule],
  controllers: [RoomController],
  providers: [RoomService, RoomStatusBoardService],
  exports: [RoomService],
})
export class RoomModule {}
