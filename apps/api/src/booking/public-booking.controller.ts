import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import type {
  AvailableRoomDto,
  BookingDto,
  RatePlanDto,
  RoomTypeDto,
} from '@nugget/shared-types';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { RatePlanService } from '../rate-plan/rate-plan.service';
import { RoomTypeService } from '../room-type/room-type.service';
import { BookingService } from './booking.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { RoomAvailabilityQueryDto } from './dto/room-availability-query.dto';

class PublicRoomTypesQueryDto {
  @IsUUID()
  branchId: string;
}

class PublicRatePlansQueryDto {
  @IsUUID()
  roomTypeId: string;

  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;
}

/**
 * Unauthenticated surface for PRD §5.2's "guest-facing booking API". No
 * JwtAuthGuard/RolesGuard here by design — every method must therefore do
 * its own branch validation rather than relying on the scoped Prisma client
 * (which bypasses scoping entirely when there's no actor in CLS context).
 * Deliberately minimal: browsing + creating a HELD booking. Guest account,
 * booking history, and modify/cancel-by-guest are Milestone 13's job.
 */
@Controller('public')
export class PublicBookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly roomTypeService: RoomTypeService,
    private readonly ratePlanService: RatePlanService,
  ) {}

  @Get('room-types')
  listRoomTypes(
    @Query() query: PublicRoomTypesQueryDto,
  ): Promise<RoomTypeDto[]> {
    return this.roomTypeService.listPublic(query.branchId);
  }

  @Get('rate-plans')
  listRatePlans(
    @Query() query: PublicRatePlansQueryDto,
  ): Promise<RatePlanDto[]> {
    return this.ratePlanService.list(
      query.roomTypeId,
      query.checkInDate,
      query.checkOutDate,
    );
  }

  @Get('rooms/availability')
  checkAvailability(
    @Query() query: RoomAvailabilityQueryDto,
  ): Promise<AvailableRoomDto[]> {
    return this.bookingService.findAvailableRoomsPublic(query);
  }

  @Post('bookings')
  create(@Body() dto: CreatePublicBookingDto): Promise<BookingDto> {
    return this.bookingService.createForGuest(dto);
  }
}
