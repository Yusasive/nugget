import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor(configService: ConfigService) {
    super(configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    // ioredis (and Node's EventEmitter generally) throws — crashing the
    // whole process — if an 'error' event has no listener. Serverless
    // containers freeze between invocations; if the remote end closes the
    // idle socket while frozen, thawing back up surfaces that as an 'error'
    // here, unrelated to whatever request happens to be running when it
    // fires. Without this listener, every route becomes a crash risk, not
    // just the ones that touch Redis.
    this.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  async onModuleInit() {
    await this.connect();
    this.logger.log('Connected to Redis/Valkey');
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
