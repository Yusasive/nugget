import { IsOptional, IsString, IsUUID } from 'class-validator';
import type { RoomTransferRequestBody } from '@nugget/shared-types';

export class RoomTransferDto implements RoomTransferRequestBody {
  @IsUUID()
  toRoomId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
