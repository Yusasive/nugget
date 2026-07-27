import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ExpenseCategoryDto } from '@nugget/shared-types';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { toExpenseCategoryDto } from './expense-category.mapper';

/**
 * Minimal by design — full category management (rename, deactivate) is
 * Milestone 9 scope. This exists in Milestone 8 only so a purchase record
 * has somewhere to file its auto-created expense (see
 * expense-category.util.ts's findOrCreateRestaurantPurchasesCategory).
 */
@Injectable()
export class ExpenseCategoryService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(): Promise<ExpenseCategoryDto[]> {
    const categories = await this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });
    return categories.map(toExpenseCategoryDto);
  }

  async findOneOrThrow(id: string): Promise<ExpenseCategoryDto> {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Expense category not found');
    }
    return toExpenseCategoryDto(category);
  }

  async create(dto: CreateExpenseCategoryDto): Promise<ExpenseCategoryDto> {
    const category = await this.prisma.expenseCategory.create({ data: dto });
    return toExpenseCategoryDto(category);
  }
}
