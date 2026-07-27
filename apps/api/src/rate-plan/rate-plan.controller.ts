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
import type { RatePlanDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from './dto/update-rate-plan.dto';
import { RatePlanService } from './rate-plan.service';

@Controller('rate-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RatePlanController {
  constructor(private readonly ratePlanService: RatePlanService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  list(
    @Query('roomTypeId') roomTypeId?: string,
    @Query('checkInDate') checkInDate?: string,
    @Query('checkOutDate') checkOutDate?: string,
  ): Promise<RatePlanDto[]> {
    return this.ratePlanService.list(roomTypeId, checkInDate, checkOutDate);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  findOne(@Param('id') id: string): Promise<RatePlanDto> {
    return this.ratePlanService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  create(@Body() dto: CreateRatePlanDto): Promise<RatePlanDto> {
    return this.ratePlanService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRatePlanDto,
  ): Promise<RatePlanDto> {
    return this.ratePlanService.update(id, dto);
  }
}
