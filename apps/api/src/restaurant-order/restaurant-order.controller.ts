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
  PaginatedResponse,
  RestaurantOrderDto,
} from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { CancelRestaurantOrderDto } from './dto/cancel-restaurant-order.dto';
import { CreateRestaurantOrderDto } from './dto/create-restaurant-order.dto';
import { ListRestaurantOrdersQueryDto } from './dto/list-restaurant-orders-query.dto';
import { UpdateKitchenItemStatusDto } from './dto/update-kitchen-item-status.dto';
import { RestaurantOrderService } from './restaurant-order.service';

const VIEW_ROLES = [
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'ACCOUNTANT',
  'RESTAURANT_STAFF',
] as const;
const WRITE_ROLES = [
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'RESTAURANT_STAFF',
] as const;

@Controller('restaurant-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RestaurantOrderController {
  constructor(
    private readonly restaurantOrderService: RestaurantOrderService,
  ) {}

  @Get()
  @Roles(...VIEW_ROLES)
  list(
    @Query() query: ListRestaurantOrdersQueryDto,
  ): Promise<PaginatedResponse<RestaurantOrderDto>> {
    return this.restaurantOrderService.list(query);
  }

  /** The Kitchen Display's feed — placed before `:id` so it isn't shadowed
   * by the param route. */
  @Get('kitchen-display')
  @Roles(...VIEW_ROLES)
  kitchenDisplay(): Promise<RestaurantOrderDto[]> {
    return this.restaurantOrderService.kitchenDisplay();
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id: string): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.findOneOrThrow(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  create(
    @Body() dto: CreateRestaurantOrderDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.create(dto, actor);
  }

  @Post(':id/items')
  @Roles(...WRITE_ROLES)
  addItems(
    @Param('id') id: string,
    @Body() dto: AddOrderItemsDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.addItems(id, dto, actor);
  }

  @Post(':id/send-to-kitchen')
  @Roles(...WRITE_ROLES)
  sendToKitchen(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.sendToKitchen(id, actor);
  }

  @Patch(':id/items/:itemId/kitchen-status')
  @Roles(...WRITE_ROLES)
  advanceItemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateKitchenItemStatusDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.advanceItemStatus(
      id,
      itemId,
      dto,
      actor,
    );
  }

  @Post(':id/serve')
  @Roles(...WRITE_ROLES)
  markServed(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.markServed(id, actor);
  }

  @Post(':id/bill')
  @Roles(...WRITE_ROLES)
  bill(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.bill(id, actor);
  }

  @Post(':id/cancel')
  @Roles(...WRITE_ROLES)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelRestaurantOrderDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.restaurantOrderService.cancel(id, dto, actor);
  }
}
