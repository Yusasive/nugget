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
import type { MenuItemDto, PaginatedResponse } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuItemService } from './menu-item.service';

@Controller('menu-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuItemController {
  constructor(private readonly menuItemService: MenuItemService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  list(
    @Query() query: ListMenuItemsQueryDto,
  ): Promise<PaginatedResponse<MenuItemDto>> {
    return this.menuItemService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  findOne(@Param('id') id: string): Promise<MenuItemDto> {
    return this.menuItemService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  create(@Body() dto: CreateMenuItemDto): Promise<MenuItemDto> {
    return this.menuItemService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItemDto> {
    return this.menuItemService.update(id, dto);
  }
}
