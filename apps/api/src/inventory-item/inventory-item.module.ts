import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryItemController } from './inventory-item.controller';
import { InventoryItemService } from './inventory-item.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [InventoryItemController],
  providers: [InventoryItemService],
  exports: [InventoryItemService],
})
export class InventoryItemModule {}
