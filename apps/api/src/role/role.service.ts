import { Injectable } from '@nestjs/common';
import type { RoleDto, StaffRoleName } from '@nugget/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { label: 'asc' },
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name as StaffRoleName,
      label: role.label,
    }));
  }
}
