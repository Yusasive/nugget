import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResponse, TourPackageDto } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTourPackageDto } from './dto/create-tour-package.dto';
import { ListTourPackagesQueryDto } from './dto/list-tour-packages-query.dto';
import { UpdateTourPackageDto } from './dto/update-tour-package.dto';
import { toTourPackageDto } from './tour-package.mapper';

@Injectable()
export class TourPackageService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
    private readonly rawPrisma: PrismaService,
  ) {}

  async list(
    query: ListTourPackagesQueryDto,
  ): Promise<PaginatedResponse<TourPackageDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.TourPackageWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [packages, total] = await Promise.all([
      this.prisma.tourPackage.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.tourPackage.count({ where }),
    ]);
    return buildPaginatedResponse(
      packages.map(toTourPackageDto),
      total,
      page,
      pageSize,
    );
  }

  /** Unauthenticated guest catalog browsing — branchId is explicit since
   * there's no actor context to scope by. */
  async listPublic(branchId: string): Promise<TourPackageDto[]> {
    const packages = await this.rawPrisma.tourPackage.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return packages.map(toTourPackageDto);
  }

  async findOneOrThrow(id: string): Promise<TourPackageDto> {
    const pkg = await this.prisma.tourPackage.findUnique({ where: { id } });
    if (!pkg) {
      throw new NotFoundException('Tour package not found');
    }
    return toTourPackageDto(pkg);
  }

  async create(dto: CreateTourPackageDto): Promise<TourPackageDto> {
    try {
      const pkg = await this.prisma.tourPackage.create({ data: dto });
      return toTourPackageDto(pkg);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateTourPackageDto): Promise<TourPackageDto> {
    await this.findOneOrThrow(id);
    try {
      const pkg = await this.prisma.tourPackage.update({
        where: { id },
        data: dto,
      });
      return toTourPackageDto(pkg);
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
        'A tour package with this name already exists for this branch',
      );
    }
    return err;
  }
}
