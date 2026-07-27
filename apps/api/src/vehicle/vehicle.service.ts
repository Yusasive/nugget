import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResponse, VehicleDto } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { toVehicleDto } from './vehicle.mapper';

@Injectable()
export class VehicleService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListVehiclesQueryDto,
  ): Promise<PaginatedResponse<VehicleDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.VehicleWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return buildPaginatedResponse(
      vehicles.map(toVehicleDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<VehicleDto> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return toVehicleDto(vehicle);
  }

  async create(dto: CreateVehicleDto): Promise<VehicleDto> {
    try {
      const vehicle = await this.prisma.vehicle.create({ data: dto });
      return toVehicleDto(vehicle);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateVehicleDto): Promise<VehicleDto> {
    await this.findOneOrThrow(id);
    try {
      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: dto,
      });
      return toVehicleDto(vehicle);
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
        'A vehicle with this plate number already exists for this branch',
      );
    }
    return err;
  }
}
