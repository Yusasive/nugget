import type { RoomTypeDto } from '@nugget/shared-types';
import type { RoomType } from '../generated/prisma/client';

export function toRoomTypeDto(roomType: RoomType): RoomTypeDto {
  return {
    id: roomType.id,
    branchId: roomType.branchId,
    name: roomType.name,
    description: roomType.description,
    maxOccupancy: roomType.maxOccupancy,
    amenities: roomType.amenities,
    isActive: roomType.isActive,
    createdAt: roomType.createdAt.toISOString(),
    updatedAt: roomType.updatedAt.toISOString(),
  };
}
