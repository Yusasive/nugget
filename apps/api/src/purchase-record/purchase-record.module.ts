import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PurchaseRecordController } from './purchase-record.controller';
import { PurchaseRecordService } from './purchase-record.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [PurchaseRecordController],
  providers: [PurchaseRecordService],
})
export class PurchaseRecordModule {}
