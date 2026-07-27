import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  EXPENSE_STATUSES,
  type ExpenseStatus,
  type ListExpensesQuery,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListExpensesQueryDto
  extends PaginationQueryDto
  implements ListExpensesQuery
{
  @IsOptional()
  @IsEnum(EXPENSE_STATUSES)
  status?: ExpenseStatus;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
