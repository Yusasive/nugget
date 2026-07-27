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
  InitiatePaymentResponse,
  InvoiceDto,
  PaginatedResponse,
  TourBookingDto,
} from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePaymentDto } from '../billing/dto/create-payment.dto';
import { InvoiceService } from '../billing/invoice.service';
import type { ActorContext } from '../context/actor.types';
import { CancelTourBookingDto } from './dto/cancel-tour-booking.dto';
import { CreateTourBookingDto } from './dto/create-tour-booking.dto';
import { ListTourBookingsQueryDto } from './dto/list-tour-bookings-query.dto';
import { TourBookingService } from './tour-booking.service';

@Controller('tour-bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TourBookingController {
  constructor(
    private readonly tourBookingService: TourBookingService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  list(
    @Query() query: ListTourBookingsQueryDto,
  ): Promise<PaginatedResponse<TourBookingDto>> {
    return this.tourBookingService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  findOne(@Param('id') id: string): Promise<TourBookingDto> {
    return this.tourBookingService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  create(
    @Body() dto: CreateTourBookingDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<TourBookingDto> {
    return this.tourBookingService.createForStaff(dto, actor);
  }

  @Post(':id/confirm')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  confirm(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<TourBookingDto> {
    return this.tourBookingService.confirm(id, actor);
  }

  @Post(':id/cancel')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelTourBookingDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<TourBookingDto> {
    return this.tourBookingService.cancel(id, dto, actor);
  }

  /** Standalone (not bundled with a room stay) tour booking billing —
   * mirrors FolioController's `POST /bookings/:id/invoices`. */
  @Post(':id/invoices')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  issueInvoice(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<InvoiceDto> {
    return this.invoiceService.issueInvoiceForTourBooking(id, actor);
  }

  /** Scoped to this tour booking's own invoice — see recordPayment's doc
   * comment for why this isn't just the shared `/invoices/:id/payments`. */
  @Post(':id/payments')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  recordPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<InitiatePaymentResponse> {
    return this.tourBookingService.recordPayment(id, dto, actor);
  }

  @Get(':id/invoice')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  latestInvoice(@Param('id') id: string): Promise<InvoiceDto | null> {
    return this.tourBookingService.findLatestInvoice(id);
  }
}
