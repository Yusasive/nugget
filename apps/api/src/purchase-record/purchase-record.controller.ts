import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type {
  PaginatedResponse,
  PurchaseRecordDto,
} from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CreatePurchaseRecordDto } from './dto/create-purchase-record.dto';
import { ListPurchaseRecordsQueryDto } from './dto/list-purchase-records-query.dto';
import { PurchaseRecordService } from './purchase-record.service';

@Controller('purchase-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseRecordController {
  constructor(private readonly purchaseRecordService: PurchaseRecordService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  list(
    @Query() query: ListPurchaseRecordsQueryDto,
  ): Promise<PaginatedResponse<PurchaseRecordDto>> {
    return this.purchaseRecordService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  findOne(@Param('id') id: string): Promise<PurchaseRecordDto> {
    return this.purchaseRecordService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'RESTAURANT_STAFF')
  create(
    @Body() dto: CreatePurchaseRecordDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<PurchaseRecordDto> {
    return this.purchaseRecordService.create(dto, actor);
  }
}
