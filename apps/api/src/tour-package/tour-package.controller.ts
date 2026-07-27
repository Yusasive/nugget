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
import type { PaginatedResponse, TourPackageDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTourPackageDto } from './dto/create-tour-package.dto';
import { ListTourPackagesQueryDto } from './dto/list-tour-packages-query.dto';
import { UpdateTourPackageDto } from './dto/update-tour-package.dto';
import { TourPackageService } from './tour-package.service';

@Controller('tour-packages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TourPackageController {
  constructor(private readonly tourPackageService: TourPackageService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  list(
    @Query() query: ListTourPackagesQueryDto,
  ): Promise<PaginatedResponse<TourPackageDto>> {
    return this.tourPackageService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  findOne(@Param('id') id: string): Promise<TourPackageDto> {
    return this.tourPackageService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  create(@Body() dto: CreateTourPackageDto): Promise<TourPackageDto> {
    return this.tourPackageService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTourPackageDto,
  ): Promise<TourPackageDto> {
    return this.tourPackageService.update(id, dto);
  }
}
