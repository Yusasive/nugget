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
import type { MenuCategoryDto, PaginatedResponse } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { ListMenuCategoriesQueryDto } from './dto/list-menu-categories-query.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { MenuCategoryService } from './menu-category.service';

@Controller('menu-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuCategoryController {
  constructor(private readonly menuCategoryService: MenuCategoryService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  list(
    @Query() query: ListMenuCategoriesQueryDto,
  ): Promise<PaginatedResponse<MenuCategoryDto>> {
    return this.menuCategoryService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  findOne(@Param('id') id: string): Promise<MenuCategoryDto> {
    return this.menuCategoryService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  create(@Body() dto: CreateMenuCategoryDto): Promise<MenuCategoryDto> {
    return this.menuCategoryService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategoryDto> {
    return this.menuCategoryService.update(id, dto);
  }
}
