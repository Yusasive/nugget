import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  BOOKING_STATUSES,
  type BookingStatus,
  type ListBookingsQuery,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListBookingsQueryDto
  extends PaginationQueryDto
  implements ListBookingsQuery
{
  @IsOptional()
  @IsEnum(BOOKING_STATUSES)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  guestSearch?: string;

  @IsOptional()
  @IsDateString()
  checkInDateFrom?: string;

  @IsOptional()
  @IsDateString()
  checkInDateTo?: string;

  @IsOptional()
  @IsDateString()
  checkOutDateFrom?: string;

  @IsOptional()
  @IsDateString()
  checkOutDateTo?: string;
}
