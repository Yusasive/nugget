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
import type { PaginatedResponse, RoomTypeDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { ListRoomTypesQueryDto } from './dto/list-room-types-query.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomTypeService } from './room-type.service';

@Controller('room-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomTypeController {
  constructor(private readonly roomTypeService: RoomTypeService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  list(
    @Query() query: ListRoomTypesQueryDto,
  ): Promise<PaginatedResponse<RoomTypeDto>> {
    return this.roomTypeService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  findOne(@Param('id') id: string): Promise<RoomTypeDto> {
    return this.roomTypeService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  create(@Body() dto: CreateRoomTypeDto): Promise<RoomTypeDto> {
    return this.roomTypeService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomTypeDto,
  ): Promise<RoomTypeDto> {
    return this.roomTypeService.update(id, dto);
  }
}
