import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  ROOM_BOARD_STATUSES,
  type RoomBoardStatus,
  type RoomStatusBoardQuery,
} from '@nugget/shared-types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class RoomStatusBoardQueryDto
  extends PaginationQueryDto
  implements RoomStatusBoardQuery
{
  @IsOptional()
  @IsEnum(ROOM_BOARD_STATUSES)
  status?: RoomBoardStatus;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
