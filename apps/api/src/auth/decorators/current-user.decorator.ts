import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ActorContext } from '../../context/actor.types';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ActorContext => {
    return ctx.switchToHttp().getRequest<{ user: ActorContext }>().user;
  },
);
