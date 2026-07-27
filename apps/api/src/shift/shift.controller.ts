import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PaginatedResponse, ShiftDto } from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateShiftTransactionDto } from './dto/create-shift-transaction.dto';
import { ListCashReportsQueryDto } from './dto/list-cash-reports-query.dto';
import { ListShiftsQueryDto } from './dto/list-shifts-query.dto';
import { OpenShiftDto } from './dto/open-shift.dto';
import { ShiftService } from './shift.service';

const FRONT_DESK_ROLES = [
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'FRONT_DESK',
] as const;

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  // Must come before ':id' or Nest would try to parse "mine" as an id.
  @Get('mine/current')
  @Roles(...FRONT_DESK_ROLES)
  findMyOpenShift(@CurrentUser() actor: ActorContext): Promise<ShiftDto> {
    return this.shiftService.findMyOpenShift(actor);
  }

  // Must also come before ':id' for the same reason.
  @Get('cash-reports')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT')
  listCashReports(
    @Query() query: ListCashReportsQueryDto,
  ): Promise<PaginatedResponse<ShiftDto>> {
    return this.shiftService.listCashReports(query);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  list(
    @Query() query: ListShiftsQueryDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<PaginatedResponse<ShiftDto>> {
    return this.shiftService.list(query, actor);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  findOne(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<ShiftDto> {
    return this.shiftService.findOneOrThrow(id, actor);
  }

  @Post()
  @Roles(...FRONT_DESK_ROLES)
  open(
    @Body() dto: OpenShiftDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<ShiftDto> {
    return this.shiftService.openShift(dto, actor);
  }

  @Post(':id/transactions')
  @Roles(...FRONT_DESK_ROLES)
  addTransaction(
    @Param('id') id: string,
    @Body() dto: CreateShiftTransactionDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<ShiftDto> {
    return this.shiftService.addTransaction(id, dto, actor);
  }

  @Post(':id/close')
  @Roles(...FRONT_DESK_ROLES)
  close(
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<ShiftDto> {
    return this.shiftService.closeShift(id, dto, actor);
  }
}
