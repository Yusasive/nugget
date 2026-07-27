import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PaginatedResponse, TourGuideDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTourGuideDto } from './dto/create-tour-guide.dto';
import { ListTourGuidesQueryDto } from './dto/list-tour-guides-query.dto';
import { UpdateTourGuideDto } from './dto/update-tour-guide.dto';
import { TourGuideService } from './tour-guide.service';

@Controller('tour-guides')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TourGuideController {
  constructor(private readonly tourGuideService: TourGuideService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  list(
    @Query() query: ListTourGuidesQueryDto,
  ): Promise<PaginatedResponse<TourGuideDto>> {
    return this.tourGuideService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  findOne(@Param('id') id: string): Promise<TourGuideDto> {
    return this.tourGuideService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  create(@Body() dto: CreateTourGuideDto): Promise<TourGuideDto> {
    return this.tourGuideService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTourGuideDto,
  ): Promise<TourGuideDto> {
    return this.tourGuideService.update(id, dto);
  }
}
