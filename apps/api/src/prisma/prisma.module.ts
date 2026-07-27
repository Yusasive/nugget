import { Global, Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import {
  createScopedPrismaClient,
  SCOPED_PRISMA,
} from './branch-scope.extension';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: SCOPED_PRISMA,
      useFactory: createScopedPrismaClient,
      inject: [PrismaService, ClsService],
    },
  ],
  exports: [PrismaService, SCOPED_PRISMA],
})
export class PrismaModule {}
