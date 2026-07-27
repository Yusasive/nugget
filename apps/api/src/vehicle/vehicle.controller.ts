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
import type { PaginatedResponse, VehicleDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleService } from './vehicle.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  list(
    @Query() query: ListVehiclesQueryDto,
  ): Promise<PaginatedResponse<VehicleDto>> {
    return this.vehicleService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR')
  findOne(@Param('id') id: string): Promise<VehicleDto> {
    return this.vehicleService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  create(@Body() dto: CreateVehicleDto): Promise<VehicleDto> {
    return this.vehicleService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'TOURS_COORDINATOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleDto> {
    return this.vehicleService.update(id, dto);
  }
}
