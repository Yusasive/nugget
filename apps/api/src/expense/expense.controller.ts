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
import type { ExpenseDto, PaginatedResponse } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { ExpenseService } from './expense.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Get()
  @Roles(
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'FRONT_DESK',
    'RESTAURANT_STAFF',
  )
  list(
    @Query() query: ListExpensesQueryDto,
  ): Promise<PaginatedResponse<ExpenseDto>> {
    return this.expenseService.list(query);
  }

  @Get(':id')
  @Roles(
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'FRONT_DESK',
    'RESTAURANT_STAFF',
  )
  findOne(@Param('id') id: string): Promise<ExpenseDto> {
    return this.expenseService.findOneOrThrow(id);
  }

  @Post()
  @Roles(
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'FRONT_DESK',
    'RESTAURANT_STAFF',
  )
  create(@Body() dto: CreateExpenseDto): Promise<ExpenseDto> {
    return this.expenseService.create(dto);
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT')
  approve(@Param('id') id: string): Promise<ExpenseDto> {
    return this.expenseService.approve(id);
  }

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT')
  reject(@Param('id') id: string): Promise<ExpenseDto> {
    return this.expenseService.reject(id);
  }
}
