import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthCheckResponse, HealthStatus } from '@nugget/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const body: HealthCheckResponse = {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'error',
      service: 'api',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };

    if (body.status === 'error') {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }

  private async checkDatabase(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<HealthStatus> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
