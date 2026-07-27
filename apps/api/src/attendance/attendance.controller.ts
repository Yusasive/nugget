import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { AttendanceDto, PaginatedResponse } from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { AttendanceService } from './attendance.service';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /** PRD §5.13: "a Branch Manager can see a day's attendance record for
   * their branch, correctly attributed to departments" — every other role
   * clocks themselves in/out below but doesn't get the roster view. */
  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  list(
    @Query() query: ListAttendanceQueryDto,
  ): Promise<PaginatedResponse<AttendanceDto>> {
    return this.attendanceService.list(query);
  }

  // No @Roles — any authenticated staff member clocks themselves in/out.
  @Post('clock-in')
  clockIn(@CurrentUser() actor: ActorContext): Promise<AttendanceDto> {
    return this.attendanceService.clockIn(actor);
  }

  @Post('clock-out')
  clockOut(@CurrentUser() actor: ActorContext): Promise<AttendanceDto> {
    return this.attendanceService.clockOut(actor);
  }
}
