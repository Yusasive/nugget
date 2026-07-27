import { IsOptional, IsUUID } from 'class-validator';
import type { ListPurchaseRecordsQuery } from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPurchaseRecordsQueryDto
  extends PaginationQueryDto
  implements ListPurchaseRecordsQuery
{
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
