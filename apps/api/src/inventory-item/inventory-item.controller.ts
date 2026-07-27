import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  InventoryItemDto,
  PaginatedResponse,
  StockMovementDto,
} from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { RecordStockMovementDto } from './dto/record-stock-movement.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryItemService } from './inventory-item.service';

@Controller('inventory-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryItemController {
  constructor(private readonly inventoryItemService: InventoryItemService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  list(
    @Query() query: ListInventoryItemsQueryDto,
  ): Promise<PaginatedResponse<InventoryItemDto>> {
    return this.inventoryItemService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  findOne(@Param('id') id: string): Promise<InventoryItemDto> {
    return this.inventoryItemService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  create(@Body() dto: CreateInventoryItemDto): Promise<InventoryItemDto> {
    return this.inventoryItemService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryItemService.update(id, dto);
  }

  @Post(':id/stock-movements')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  recordMovement(
    @Param('id') id: string,
    @Body() dto: RecordStockMovementDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<{
    item: InventoryItemDto;
    movement: Pick<StockMovementDto, 'id'>;
  }> {
    return this.inventoryItemService.recordMovement(id, dto, actor);
  }
}
