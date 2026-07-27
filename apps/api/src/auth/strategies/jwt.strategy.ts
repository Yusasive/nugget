import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ActorContext } from '../../context/actor.types';
import { AppClsStore } from '../../context/app-cls-store';
import { JwtPayload } from '../jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly cls: ClsService<AppClsStore>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): ActorContext {
    const actor: ActorContext = {
      staffId: payload.sub,
      role: payload.role,
      branchId: payload.branchId,
    };
    // Populates the request-scoped CLS context so the branch-scoping Prisma
    // extension (src/prisma/branch-scope.extension.ts) can read it later in
    // the request without every service needing to thread it through.
    this.cls.set('actor', actor);
    return actor;
  }
}
