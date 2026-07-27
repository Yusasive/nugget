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
import type { PaginatedResponse, StaffDto } from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  list(
    @Query() query: ListStaffQueryDto,
  ): Promise<PaginatedResponse<StaffDto>> {
    return this.staffService.list(query);
  }

  // Must come before ':id' or Nest would try to parse "me" as an id. Open to
  // every role — this is the logged-in user's own record, not a lookup that
  // needs the SUPER_ADMIN/BRANCH_MANAGER staff-directory permission below.
  @Get('me')
  getSelf(@CurrentUser() actor: ActorContext): Promise<StaffDto> {
    return this.staffService.findOneOrThrow(actor.staffId);
  }

  @Patch('me')
  updateSelf(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<StaffDto> {
    return this.staffService.updateSelf(actor.staffId, dto, actor);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  findOne(@Param('id') id: string): Promise<StaffDto> {
    return this.staffService.findOneOrThrow(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(
    @Body() dto: CreateStaffDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<StaffDto> {
    return this.staffService.create(dto, actor);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<StaffDto> {
    return this.staffService.update(id, dto, actor);
  }
}
