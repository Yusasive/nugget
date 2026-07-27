import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantTableController } from './restaurant-table.controller';
import { RestaurantTableService } from './restaurant-table.service';

@Module({
  imports: [AuthModule],
  controllers: [RestaurantTableController],
  providers: [RestaurantTableService],
  exports: [RestaurantTableService],
})
export class RestaurantTableModule {}
