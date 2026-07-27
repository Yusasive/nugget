import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GuestProfileDto, PaginatedResponse } from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { toGuestDto } from './guest.mapper';
import { ListGuestsQueryDto } from './dto/list-guests-query.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';

@Injectable()
export class GuestService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListGuestsQueryDto,
  ): Promise<PaginatedResponse<GuestProfileDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.GuestWhereInput = {
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.isVip !== undefined ? { isVip: query.isVip } : {}),
      ...(query.isBlacklisted !== undefined
        ? { isBlacklisted: query.isBlacklisted }
        : {}),
    };

    const [guests, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guest.count({ where }),
    ]);
    return buildPaginatedResponse(
      guests.map(toGuestDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<GuestProfileDto> {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Guest not found');
    return toGuestDto(guest);
  }

  async redact(id: string): Promise<void> {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      include: {
        bookings: { where: { status: { in: ['HELD', 'CONFIRMED', 'CHECKED_IN'] } }, take: 1 },
        tourBookings: { where: { status: { in: ['HELD', 'CONFIRMED'] } }, take: 1 },
      },
    });
    if (!guest) throw new NotFoundException('Guest not found');
    if (guest.bookings.length || guest.tourBookings.length) {
      throw new BadRequestException(
        'Cannot redact a guest with active bookings',
      );
    }
    // NDPR right-to-erasure: null out all PII fields rather than deleting
    // the row, so historical booking/invoice/payment records that reference
    // this guest id remain intact (referential integrity) but carry no
    // personally identifiable data.
    await this.prisma.guest.update({
      where: { id },
      data: {
        firstName: '[redacted]',
        lastName: '[redacted]',
        email: null,
        phone: null,
        preferences: null,
        notes: null,
      },
    });
  }

  async update(id: string, dto: UpdateGuestDto): Promise<GuestProfileDto> {
    const existing = await this.prisma.guest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Guest not found');
    const updated = await this.prisma.guest.update({
      where: { id },
      data: dto,
    });
    return toGuestDto(updated);
  }
}
