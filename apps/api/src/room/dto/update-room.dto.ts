import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import type { UpdateRoomRequestBody } from '@nugget/shared-types';

export class UpdateRoomDto implements UpdateRoomRequestBody {
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  roomNumber?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
