import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuditLogEntryDto, PaginatedResponse } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';

/** PRD §5.14/§5.15's staff activity/audit log viewer. */
@Controller('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  list(
    @Query() query: ListAuditLogQueryDto,
  ): Promise<PaginatedResponse<AuditLogEntryDto>> {
    return this.auditLogService.list(query);
  }
}
