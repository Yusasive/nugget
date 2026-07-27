import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RatePlanDto } from '@nugget/shared-types';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from './dto/update-rate-plan.dto';
import { toRatePlanDto } from './rate-plan.mapper';

@Injectable()
export class RatePlanService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  /**
   * When checkInDate/checkOutDate are given, only returns plans actually
   * eligible for that stay (per-plan validFrom/validTo window) — this is
   * what the booking screen calls to populate its rate-plan choices.
   */
  async list(
    roomTypeId?: string,
    checkInDate?: string,
    checkOutDate?: string,
  ): Promise<RatePlanDto[]> {
    const dateFilter =
      checkInDate && checkOutDate
        ? {
            AND: [
              {
                OR: [
                  { validFrom: null },
                  { validFrom: { lte: new Date(checkInDate) } },
                ],
              },
              {
                OR: [
                  { validTo: null },
                  { validTo: { gte: new Date(checkOutDate) } },
                ],
              },
            ],
          }
        : {};

    const ratePlans = await this.prisma.ratePlan.findMany({
      where: {
        ...(roomTypeId ? { roomTypeId } : {}),
        isActive: true,
        ...dateFilter,
      },
      orderBy: { pricePerNight: 'asc' },
    });
    return ratePlans.map(toRatePlanDto);
  }

  async findOneOrThrow(id: string): Promise<RatePlanDto> {
    const ratePlan = await this.prisma.ratePlan.findUnique({ where: { id } });
    if (!ratePlan) {
      throw new NotFoundException('Rate plan not found');
    }
    return toRatePlanDto(ratePlan);
  }

  async create(dto: CreateRatePlanDto): Promise<RatePlanDto> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: dto.roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    const ratePlan = await this.prisma.ratePlan.create({
      data: {
        branchId: roomType.branchId,
        roomTypeId: dto.roomTypeId,
        name: dto.name,
        type: dto.type,
        pricePerNight: dto.pricePerNight,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      },
    });
    return toRatePlanDto(ratePlan);
  }

  async update(id: string, dto: UpdateRatePlanDto): Promise<RatePlanDto> {
    await this.findOneOrThrow(id);
    const ratePlan = await this.prisma.ratePlan.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        pricePerNight: dto.pricePerNight,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        isActive: dto.isActive,
      },
    });
    return toRatePlanDto(ratePlan);
  }
}
