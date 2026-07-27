import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  HousekeepingTaskDto,
  PaginatedResponse,
} from '@nugget/shared-types';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import {
  HOUSEKEEPING_TASK_INCLUDE,
  toHousekeepingTaskDto,
} from './housekeeping-task.mapper';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { ListHousekeepingTasksQueryDto } from './dto/list-housekeeping-tasks-query.dto';
import { UpdateHousekeepingTaskDto } from './dto/update-housekeeping-task.dto';

@Injectable()
export class HousekeepingTaskService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly prisma: ScopedPrismaClient,
  ) {}

  async list(
    query: ListHousekeepingTasksQueryDto,
  ): Promise<PaginatedResponse<HousekeepingTaskDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.HousekeepingTaskWhereInput = {
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.housekeepingTask.findMany({
        where,
        skip,
        take,
        include: HOUSEKEEPING_TASK_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.housekeepingTask.count({ where }),
    ]);
    return buildPaginatedResponse(
      tasks.map(toHousekeepingTaskDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<HousekeepingTaskDto> {
    const task = await this.prisma.housekeepingTask.findUnique({
      where: { id },
      include: HOUSEKEEPING_TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Housekeeping task not found');
    return toHousekeepingTaskDto(task);
  }

  async create(dto: CreateHousekeepingTaskDto): Promise<HousekeepingTaskDto> {
    const task = await this.prisma.housekeepingTask.create({
      data: {
        branchId: dto.branchId,
        roomId: dto.roomId,
        assignedToStaffId: dto.assignedToStaffId ?? null,
        description: dto.description,
      },
      include: HOUSEKEEPING_TASK_INCLUDE,
    });
    return toHousekeepingTaskDto(task);
  }

  async update(
    id: string,
    dto: UpdateHousekeepingTaskDto,
  ): Promise<HousekeepingTaskDto> {
    const task = await this.prisma.housekeepingTask.findUnique({
      where: { id },
      include: HOUSEKEEPING_TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Housekeeping task not found');

    const becomingDone = dto.status === 'DONE' && task.status !== 'DONE';

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.housekeepingTask.update({
        where: { id },
        data: {
          ...(dto.assignedToStaffId !== undefined
            ? { assignedToStaffId: dto.assignedToStaffId }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(becomingDone ? { completedAt: new Date() } : {}),
        },
        include: HOUSEKEEPING_TASK_INCLUDE,
      });

      // Completing a task marks the room CLEAN — the gate that allows
      // check-in/transfer into it (M3 README: "housekeepingStatus flips
      // back to CLEAN only via an explicit housekeeping action").
      if (becomingDone) {
        await tx.room.update({
          where: { id: task.roomId },
          data: { housekeepingStatus: 'CLEAN' },
        });
      }

      return result;
    });

    return toHousekeepingTaskDto(updated);
  }
}
