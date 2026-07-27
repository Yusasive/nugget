import type { RoomDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export type RoomWithType = Prisma.RoomGetPayload<{
  include: { roomType: true };
}>;

export function toRoomDto(room: RoomWithType): RoomDto {
  return {
    id: room.id,
    branchId: room.branchId,
    roomNumber: room.roomNumber,
    floor: room.floor,
    isOutOfOrder: room.isOutOfOrder,
    outOfOrderReason: room.outOfOrderReason,
    outOfOrderUntil: room.outOfOrderUntil
      ? room.outOfOrderUntil.toISOString()
      : null,
    housekeepingStatus: room.housekeepingStatus,
    isActive: room.isActive,
    createdAt: room.createdAt.toISOString(),
    roomType: {
      id: room.roomType.id,
      name: room.roomType.name,
      maxOccupancy: room.roomType.maxOccupancy,
    },
  };
}
