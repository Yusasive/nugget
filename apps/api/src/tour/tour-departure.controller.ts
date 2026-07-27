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
  PaginatedResponse,
  TourDepartureDto,
  TourManifestDto,
} from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CreateTourDepartureDto } from './dto/create-tour-departure.dto';
import { ListTourDeparturesQueryDto } from './dto/list-tour-departures-query.dto';
import { TourDepartureService } from './tour-departure.service';

@Controller('tour-departures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TourDepartureController {
  constructor(private readonly tourDepartureService: TourDepartureService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  list(
    @Query() query: ListTourDeparturesQueryDto,
  ): Promise<PaginatedResponse<TourDepartureDto>> {
    return this.tourDepartureService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  findOne(@Param('id') id: string): Promise<TourDepartureDto> {
    return this.tourDepartureService.findOneOrThrow(id);
  }

  @Get(':id/manifest')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  manifest(@Param('id') id: string): Promise<TourManifestDto> {
    return this.tourDepartureService.getManifest(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  create(
    @Body() dto: CreateTourDepartureDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<TourDepartureDto> {
    return this.tourDepartureService.create(dto, actor);
  }

  @Post(':id/cancel')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  cancel(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<TourDepartureDto> {
    return this.tourDepartureService.cancel(id, actor);
  }
}
