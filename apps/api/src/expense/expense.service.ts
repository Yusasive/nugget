import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ExpenseDto, PaginatedResponse } from '@nugget/shared-types';
import { ClsService } from 'nestjs-cls';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { AppClsStore } from '../context/app-cls-store';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { EXPENSE_INCLUDE, toExpenseDto } from './expense.mapper';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async list(
    query: ListExpensesQueryDto,
  ): Promise<PaginatedResponse<ExpenseDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.ExpenseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take,
        include: EXPENSE_INCLUDE,
        orderBy: { incurredAt: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);
    return buildPaginatedResponse(
      expenses.map(toExpenseDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<ExpenseDto> {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return toExpenseDto(expense);
  }

  async create(dto: CreateExpenseDto): Promise<ExpenseDto> {
    const actor = this.cls.get('actor')!;
    const expense = await this.prisma.expense.create({
      data: {
        branchId: dto.branchId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        description: dto.description,
        incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
        createdByStaffId: actor.staffId,
        status: 'PENDING',
      },
      include: EXPENSE_INCLUDE,
    });
    return toExpenseDto(expense);
  }

  async approve(id: string): Promise<ExpenseDto> {
    const actor = this.cls.get('actor')!;
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status !== 'PENDING')
      throw new BadRequestException('Only PENDING expenses can be approved');
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: 'APPROVED', approvedByStaffId: actor.staffId },
      include: EXPENSE_INCLUDE,
    });
    return toExpenseDto(updated);
  }

  async reject(id: string): Promise<ExpenseDto> {
    const actor = this.cls.get('actor')!;
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status !== 'PENDING')
      throw new BadRequestException('Only PENDING expenses can be rejected');
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: 'REJECTED', approvedByStaffId: actor.staffId },
      include: EXPENSE_INCLUDE,
    });
    return toExpenseDto(updated);
  }
}
