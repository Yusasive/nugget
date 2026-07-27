import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AvailableRoomDto,
  BookingDto,
  PaginatedResponse,
} from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { BookingService } from './booking.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { RoomAvailabilityQueryDto } from './dto/room-availability-query.dto';
import { RoomTransferDto } from './dto/room-transfer.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // Must come before ':id' or Nest would try to parse "availability" as an id.
  @Get('availability')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  checkAvailability(
    @Query() query: RoomAvailabilityQueryDto,
  ): Promise<AvailableRoomDto[]> {
    return this.bookingService.findAvailableRoomsForStaff(query);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  list(
    @Query() query: ListBookingsQueryDto,
  ): Promise<PaginatedResponse<BookingDto>> {
    return this.bookingService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  findOne(@Param('id') id: string): Promise<BookingDto> {
    return this.bookingService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<BookingDto> {
    return this.bookingService.createForStaff(dto, actor);
  }

  @Post(':id/confirm')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  confirm(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<BookingDto> {
    return this.bookingService.confirm(id, actor);
  }

  @Post(':id/cancel')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<BookingDto> {
    return this.bookingService.cancel(id, dto, actor);
  }

  @Post(':id/check-in')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<BookingDto> {
    return this.bookingService.checkIn(id, dto, actor);
  }

  @Post(':id/check-out')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  checkOut(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<BookingDto> {
    return this.bookingService.checkOut(id, actor);
  }

  @Post(':id/transfer')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  transfer(
    @Param('id') id: string,
    @Body() dto: RoomTransferDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<BookingDto> {
    return this.bookingService.transfer(id, dto, actor);
  }
}
