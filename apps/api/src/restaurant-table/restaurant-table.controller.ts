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
  RestaurantTableDto,
} from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { ListRestaurantTablesQueryDto } from './dto/list-restaurant-tables-query.dto';
import { SetRestaurantTableStatusDto } from './dto/set-restaurant-table-status.dto';
import { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import { RestaurantTableService } from './restaurant-table.service';

@Controller('restaurant-tables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RestaurantTableController {
  constructor(
    private readonly restaurantTableService: RestaurantTableService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  list(
    @Query() query: ListRestaurantTablesQueryDto,
  ): Promise<PaginatedResponse<RestaurantTableDto>> {
    return this.restaurantTableService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  findOne(@Param('id') id: string): Promise<RestaurantTableDto> {
    return this.restaurantTableService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  create(
    @Body() dto: CreateRestaurantTableDto,
  ): Promise<RestaurantTableDto> {
    return this.restaurantTableService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantTableDto,
  ): Promise<RestaurantTableDto> {
    return this.restaurantTableService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetRestaurantTableStatusDto,
  ): Promise<RestaurantTableDto> {
    return this.restaurantTableService.setStatus(id, dto);
  }
}
