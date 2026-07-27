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
import type { BranchDto, PaginatedResponse } from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ListBranchesQueryDto } from './dto/list-branches-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  list(
    @Query() query: ListBranchesQueryDto,
  ): Promise<PaginatedResponse<BranchDto>> {
    return this.branchService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<BranchDto> {
    return this.branchService.findOneOrThrow(id);
  }

  @Post()
  create(
    @Body() dto: CreateBranchDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<BranchDto> {
    return this.branchService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<BranchDto> {
    return this.branchService.update(id, dto, actor);
  }
}
