import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResponse, TourGuideDto } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { CreateTourGuideDto } from './dto/create-tour-guide.dto';
import { ListTourGuidesQueryDto } from './dto/list-tour-guides-query.dto';
import { UpdateTourGuideDto } from './dto/update-tour-guide.dto';
import { toTourGuideDto } from './tour-guide.mapper';

@Injectable()
export class TourGuideService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListTourGuidesQueryDto,
  ): Promise<PaginatedResponse<TourGuideDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.TourGuideWhereInput = {
      ...(query.search
        ? { fullName: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [guides, total] = await Promise.all([
      this.prisma.tourGuide.findMany({
        where,
        skip,
        take,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.tourGuide.count({ where }),
    ]);
    return buildPaginatedResponse(
      guides.map(toTourGuideDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<TourGuideDto> {
    const guide = await this.prisma.tourGuide.findUnique({ where: { id } });
    if (!guide) {
      throw new NotFoundException('Tour guide not found');
    }
    return toTourGuideDto(guide);
  }

  async create(dto: CreateTourGuideDto): Promise<TourGuideDto> {
    const guide = await this.prisma.tourGuide.create({ data: dto });
    return toTourGuideDto(guide);
  }

  async update(id: string, dto: UpdateTourGuideDto): Promise<TourGuideDto> {
    await this.findOneOrThrow(id);
    const guide = await this.prisma.tourGuide.update({
      where: { id },
      data: dto,
    });
    return toTourGuideDto(guide);
  }
}
