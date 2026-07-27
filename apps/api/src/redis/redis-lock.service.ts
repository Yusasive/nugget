import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Atomic compare-and-delete: only release a lock if we're still the holder
 * (guards against releasing a lock some other request has since acquired
 * after ours expired). */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class LockAcquisitionError extends Error {
  constructor(key: string) {
    super(`Could not acquire lock for "${key}" — resource is busy`);
    this.name = 'LockAcquisitionError';
  }
}

interface WithLockOptions {
  /** Safety-net expiry in case the holder crashes mid-operation. */
  ttlMs?: number;
  /** How many times to retry before giving up. */
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Redis-backed mutex (TRD §6: "Redis/Valkey lock on room_id + date_range,
 * re-check in Postgres inside a transaction"). This is the first line of
 * defense against two concurrent requests both trying to book the same
 * room — it serializes attempts before they ever reach the database. It is
 * NOT the sole guarantee: the caller's Postgres transaction must still
 * re-check for overlaps under a row lock, in case this lock ever expires
 * early or a caller bypasses it by mistake.
 */
@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(private readonly redis: RedisService) {}

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: WithLockOptions = {},
  ): Promise<T> {
    const ttlMs = options.ttlMs ?? 10_000;
    const retries = options.retries ?? 10;
    const retryDelayMs = options.retryDelayMs ?? 100;
    const token = randomUUID();

    let acquired = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        acquired = true;
        break;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    if (!acquired) {
      throw new LockAcquisitionError(key);
    }

    try {
      return await fn();
    } finally {
      try {
        await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
      } catch (err) {
        // Losing the release isn't fatal — the TTL still frees the key —
        // but it's worth knowing about if it happens often.
        this.logger.warn(
          `Failed to release lock "${key}": ${(err as Error).message}`,
        );
      }
    }
  }
}
