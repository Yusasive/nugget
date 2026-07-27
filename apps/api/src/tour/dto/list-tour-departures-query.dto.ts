import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  TOUR_DEPARTURE_STATUSES,
  type ListTourDeparturesQuery,
  type TourDepartureStatus,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListTourDeparturesQueryDto
  extends PaginationQueryDto
  implements ListTourDeparturesQuery
{
  @IsOptional()
  @IsUUID()
  tourPackageId?: string;

  @IsOptional()
  @IsEnum(TOUR_DEPARTURE_STATUSES)
  status?: TourDepartureStatus;

  @IsOptional()
  @IsDateString()
  departureFrom?: string;

  @IsOptional()
  @IsDateString()
  departureTo?: string;
}
