import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  TOUR_BOOKING_STATUSES,
  type ListTourBookingsQuery,
  type TourBookingStatus,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListTourBookingsQueryDto
  extends PaginationQueryDto
  implements ListTourBookingsQuery
{
  @IsOptional()
  @IsEnum(TOUR_BOOKING_STATUSES)
  status?: TourBookingStatus;

  @IsOptional()
  @IsUUID()
  tourDepartureId?: string;
}
