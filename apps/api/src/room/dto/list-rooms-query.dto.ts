import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  HOUSEKEEPING_STATUSES,
  type HousekeepingStatus,
  type ListRoomsQuery,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from '../../common/transformers';

export class ListRoomsQueryDto
  extends PaginationQueryDto
  implements ListRoomsQuery
{
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  isOutOfOrder?: boolean;

  @IsOptional()
  @IsEnum(HOUSEKEEPING_STATUSES)
  housekeepingStatus?: HousekeepingStatus;
}
