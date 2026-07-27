import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRoleName } from '@nugget/shared-types';
import type { ActorContext } from '../../context/actor.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      StaffRoleName[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const actor = context
      .switchToHttp()
      .getRequest<{ user?: ActorContext }>().user;

    // Super Admin has full access everywhere per the PRD's permission matrix
    // (§7) — every other role must be explicitly listed on the route.
    return (
      actor?.role === 'SUPER_ADMIN' ||
      (!!actor && requiredRoles.includes(actor.role))
    );
  }
}
