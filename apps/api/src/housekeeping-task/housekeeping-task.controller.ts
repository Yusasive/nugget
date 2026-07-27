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
import type { HousekeepingTaskDto, PaginatedResponse } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { ListHousekeepingTasksQueryDto } from './dto/list-housekeeping-tasks-query.dto';
import { UpdateHousekeepingTaskDto } from './dto/update-housekeeping-task.dto';
import { HousekeepingTaskService } from './housekeeping-task.service';

@Controller('housekeeping-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HousekeepingTaskController {
  constructor(private readonly service: HousekeepingTaskService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING')
  list(
    @Query() query: ListHousekeepingTasksQueryDto,
  ): Promise<PaginatedResponse<HousekeepingTaskDto>> {
    return this.service.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING')
  findOne(@Param('id') id: string): Promise<HousekeepingTaskDto> {
    return this.service.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  create(@Body() dto: CreateHousekeepingTaskDto): Promise<HousekeepingTaskDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHousekeepingTaskDto,
  ): Promise<HousekeepingTaskDto> {
    return this.service.update(id, dto);
  }
}
