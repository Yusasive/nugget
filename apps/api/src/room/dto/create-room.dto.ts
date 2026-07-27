import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import type { CreateRoomRequestBody } from '@nugget/shared-types';

export class CreateRoomDto implements CreateRoomRequestBody {
  @IsUUID()
  roomTypeId: string;

  @IsString()
  @MinLength(1)
  roomNumber: string;

  @IsOptional()
  @IsString()
  floor?: string;
}
