import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import type {
  TourBookingDto,
  TourDepartureDto,
  TourPackageDto,
} from '@nugget/shared-types';
import { TourPackageService } from '../tour-package/tour-package.service';
import { CreatePublicTourBookingDto } from './dto/create-public-tour-booking.dto';
import { PublicTourDeparturesQueryDto } from './dto/public-tour-departures-query.dto';
import { TourBookingService } from './tour-booking.service';
import { TourDepartureService } from './tour-departure.service';

class PublicTourPackagesQueryDto {
  @IsUUID()
  branchId: string;
}

/**
 * Unauthenticated surface for PRD §5.8's "guest booking flow for tours,
 * either standalone or bundled with a room stay" — deliberately minimal,
 * mirroring booking/public-booking.controller.ts exactly: browsing plus
 * creating a HELD booking. A real guest checkout UI (and self-serve payment)
 * is Milestone 13's job, same staging as room bookings.
 */
@Controller('public')
export class PublicTourController {
  constructor(
    private readonly tourPackageService: TourPackageService,
    private readonly tourDepartureService: TourDepartureService,
    private readonly tourBookingService: TourBookingService,
  ) {}

  @Get('tour-packages')
  listTourPackages(
    @Query() query: PublicTourPackagesQueryDto,
  ): Promise<TourPackageDto[]> {
    return this.tourPackageService.listPublic(query.branchId);
  }

  @Get('tour-departures')
  listTourDepartures(
    @Query() query: PublicTourDeparturesQueryDto,
  ): Promise<TourDepartureDto[]> {
    return this.tourDepartureService.listPublicUpcomingByPackage(
      query.tourPackageId,
    );
  }

  @Post('tour-bookings')
  create(@Body() dto: CreatePublicTourBookingDto): Promise<TourBookingDto> {
    return this.tourBookingService.createForGuest(dto);
  }
}
