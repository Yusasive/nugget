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
import type {
  PaginatedResponse,
  RoomDto,
  RoomStatusBoardEntry,
} from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto';
import { RoomStatusBoardQueryDto } from './dto/room-status-board-query.dto';
import { SetHousekeepingStatusDto } from './dto/set-housekeeping-status.dto';
import { SetRoomOutOfOrderDto } from './dto/set-room-out-of-order.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomStatusBoardService } from './room-status-board.service';
import { RoomService } from './room.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly roomStatusBoardService: RoomStatusBoardService,
  ) {}

  // Must come before ':id' or Nest would try to parse "status-board" as an id.
  @Get('status-board')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING')
  getStatusBoard(
    @Query() query: RoomStatusBoardQueryDto,
  ): Promise<PaginatedResponse<RoomStatusBoardEntry>> {
    return this.roomStatusBoardService.getBoard(query);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING')
  list(@Query() query: ListRoomsQueryDto): Promise<PaginatedResponse<RoomDto>> {
    return this.roomService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING')
  findOne(@Param('id') id: string): Promise<RoomDto> {
    return this.roomService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  create(@Body() dto: CreateRoomDto): Promise<RoomDto> {
    return this.roomService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomDto> {
    return this.roomService.update(id, dto);
  }

  @Patch(':id/out-of-order')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  setOutOfOrder(
    @Param('id') id: string,
    @Body() dto: SetRoomOutOfOrderDto,
  ): Promise<RoomDto> {
    return this.roomService.setOutOfOrder(id, dto);
  }

  @Patch(':id/housekeeping-status')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'HOUSEKEEPING')
  setHousekeepingStatus(
    @Param('id') id: string,
    @Body() dto: SetHousekeepingStatusDto,
  ): Promise<RoomDto> {
    return this.roomService.setHousekeepingStatus(id, dto);
  }
}
