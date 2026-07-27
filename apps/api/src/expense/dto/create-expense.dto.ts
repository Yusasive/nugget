import { IsDateString, IsDecimal, IsOptional, IsString, IsUUID } from 'class-validator';
import type { CreateExpenseRequestBody } from '@nugget/shared-types';

export class CreateExpenseDto implements CreateExpenseRequestBody {
  @IsUUID()
  branchId: string;

  @IsUUID()
  categoryId: string;

  @IsDecimal()
  amount: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsDateString()
  incurredAt?: string;
}
