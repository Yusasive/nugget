import { Controller, Get, UseGuards } from '@nestjs/common';
import type { RoleDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RoleService } from './role.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  list(): Promise<RoleDto[]> {
    return this.roleService.list();
  }
}
