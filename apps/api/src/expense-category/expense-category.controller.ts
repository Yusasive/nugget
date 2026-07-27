import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { ExpenseCategoryDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { ExpenseCategoryService } from './expense-category.service';

@Controller('expense-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseCategoryController {
  constructor(
    private readonly expenseCategoryService: ExpenseCategoryService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  list(): Promise<ExpenseCategoryDto[]> {
    return this.expenseCategoryService.list();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF')
  findOne(@Param('id') id: string): Promise<ExpenseCategoryDto> {
    return this.expenseCategoryService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT')
  create(
    @Body() dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategoryDto> {
    return this.expenseCategoryService.create(dto);
  }
}
