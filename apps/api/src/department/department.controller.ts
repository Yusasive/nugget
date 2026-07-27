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
import type { DepartmentDto } from '@nugget/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  list(
    @Query('branchId') branchId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<DepartmentDto[]> {
    const parsedIsActive =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.departmentService.list(branchId, parsedIsActive);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentDto> {
    return this.departmentService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentDto> {
    return this.departmentService.update(id, dto);
  }
}
