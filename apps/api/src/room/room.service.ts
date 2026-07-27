import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResponse, RoomDto } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto';
import { SetHousekeepingStatusDto } from './dto/set-housekeeping-status.dto';
import { SetRoomOutOfOrderDto } from './dto/set-room-out-of-order.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { toRoomDto } from './room.mapper';

const ROOM_INCLUDE = { roomType: true } as const;

@Injectable()
export class RoomService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(query: ListRoomsQueryDto): Promise<PaginatedResponse<RoomDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.RoomWhereInput = {
      ...(query.search
        ? { roomNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.isOutOfOrder !== undefined
        ? { isOutOfOrder: query.isOutOfOrder }
        : {}),
      ...(query.housekeepingStatus
        ? { housekeepingStatus: query.housekeepingStatus }
        : {}),
    };

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take,
        include: ROOM_INCLUDE,
        orderBy: { roomNumber: 'asc' },
      }),
      this.prisma.room.count({ where }),
    ]);
    return buildPaginatedResponse(rooms.map(toRoomDto), total, page, pageSize);
  }

  async findOneOrThrow(id: string): Promise<RoomDto> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: ROOM_INCLUDE,
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return toRoomDto(room);
  }

  /**
   * branchId is deliberately not a client-supplied field here: it's derived
   * from the chosen room type so a room can never end up in a different
   * branch than its own room type (roomTypeId lookup goes through the same
   * scoped client, so referencing another branch's room type 404s instead
   * of silently succeeding).
   */
  async create(dto: CreateRoomDto): Promise<RoomDto> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: dto.roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    try {
      const room = await this.prisma.room.create({
        data: {
          branchId: roomType.branchId,
          roomTypeId: dto.roomTypeId,
          roomNumber: dto.roomNumber,
          floor: dto.floor,
        },
        include: ROOM_INCLUDE,
      });
      return toRoomDto(room);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomDto> {
    await this.findOneOrThrow(id);

    if (dto.roomTypeId) {
      const roomType = await this.prisma.roomType.findUnique({
        where: { id: dto.roomTypeId },
      });
      if (!roomType) {
        throw new NotFoundException('Room type not found');
      }
    }

    try {
      const room = await this.prisma.room.update({
        where: { id },
        data: dto,
        include: ROOM_INCLUDE,
      });
      return toRoomDto(room);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async setOutOfOrder(id: string, dto: SetRoomOutOfOrderDto): Promise<RoomDto> {
    await this.findOneOrThrow(id);
    const room = await this.prisma.room.update({
      where: { id },
      data: {
        isOutOfOrder: dto.isOutOfOrder,
        outOfOrderReason: dto.isOutOfOrder ? (dto.reason ?? null) : null,
        outOfOrderUntil:
          dto.isOutOfOrder && dto.until ? new Date(dto.until) : null,
      },
      include: ROOM_INCLUDE,
    });
    return toRoomDto(room);
  }

  async setHousekeepingStatus(
    id: string,
    dto: SetHousekeepingStatusDto,
  ): Promise<RoomDto> {
    await this.findOneOrThrow(id);
    const room = await this.prisma.room.update({
      where: { id },
      data: { housekeepingStatus: dto.housekeepingStatus },
      include: ROOM_INCLUDE,
    });
    return toRoomDto(room);
  }

  private translateUniqueViolation(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(
        'A room with this number already exists for this branch',
      );
    }
    return err;
  }
}
