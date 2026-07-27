import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { GuestProfileDto, PaginatedResponse } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListGuestsQueryDto } from './dto/list-guests-query.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestService } from './guest.service';

@Controller('guests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  list(
    @Query() query: ListGuestsQueryDto,
  ): Promise<PaginatedResponse<GuestProfileDto>> {
    return this.guestService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  findOne(@Param('id') id: string): Promise<GuestProfileDto> {
    return this.guestService.findOneOrThrow(id);
  }

  @Delete(':id/redact')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async redact(@Param('id') id: string): Promise<void> {
    await this.guestService.redact(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGuestDto,
  ): Promise<GuestProfileDto> {
    return this.guestService.update(id, dto);
  }
}
