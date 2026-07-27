import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResponse, RoomTypeDto } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { ListRoomTypesQueryDto } from './dto/list-room-types-query.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { toRoomTypeDto } from './room-type.mapper';

@Injectable()
export class RoomTypeService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
    private readonly rawPrisma: PrismaService,
  ) {}

  async list(
    query: ListRoomTypesQueryDto,
  ): Promise<PaginatedResponse<RoomTypeDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.RoomTypeWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [roomTypes, total] = await Promise.all([
      this.prisma.roomType.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.roomType.count({ where }),
    ]);
    return buildPaginatedResponse(
      roomTypes.map(toRoomTypeDto),
      total,
      page,
      pageSize,
    );
  }

  /** Unauthenticated guest catalog browsing — branchId is explicit since
   * there's no actor context to scope by. */
  async listPublic(branchId: string): Promise<RoomTypeDto[]> {
    const roomTypes = await this.rawPrisma.roomType.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return roomTypes.map(toRoomTypeDto);
  }

  async findOneOrThrow(id: string): Promise<RoomTypeDto> {
    const roomType = await this.prisma.roomType.findUnique({ where: { id } });
    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }
    return toRoomTypeDto(roomType);
  }

  async create(dto: CreateRoomTypeDto): Promise<RoomTypeDto> {
    try {
      const roomType = await this.prisma.roomType.create({ data: dto });
      return toRoomTypeDto(roomType);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateRoomTypeDto): Promise<RoomTypeDto> {
    await this.findOneOrThrow(id);
    try {
      const roomType = await this.prisma.roomType.update({
        where: { id },
        data: dto,
      });
      return toRoomTypeDto(roomType);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  private translateUniqueViolation(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(
        'A room type with this name already exists for this branch',
      );
    }
    return err;
  }
}
