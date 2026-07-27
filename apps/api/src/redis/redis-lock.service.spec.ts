import { LockAcquisitionError, RedisLockService } from './redis-lock.service';
import type { RedisService } from './redis.service';

/**
 * Minimal stand-in implementing the same SET-NX-with-expiry and
 * compare-and-delete semantics RedisLockService relies on — enough to test
 * the locking logic itself without spinning up real Redis. The actual
 * end-to-end guarantee (real Redis + real Postgres) is proven by the
 * concurrency e2e test, not here.
 */
class FakeRedis {
  private store = new Map<string, string>();

  set(
    key: string,
    value: string,
    _mode: string,
    _ttl: number,
    flag: string,
  ): Promise<'OK' | null> {
    if (flag === 'NX' && this.store.has(key)) {
      return Promise.resolve(null);
    }
    this.store.set(key, value);
    return Promise.resolve('OK');
  }

  eval(
    _script: string,
    _numKeys: number,
    key: string,
    token: string,
  ): Promise<number> {
    if (this.store.get(key) === token) {
      this.store.delete(key);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }

  /** Test-only: simulate another holder grabbing the key after this one expired. */
  forceSet(key: string, value: string): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): string | undefined {
    return this.store.get(key);
  }
}

function makeService() {
  const redis = new FakeRedis();
  const service = new RedisLockService(redis as unknown as RedisService);
  return { redis, service };
}

describe('RedisLockService', () => {
  it('runs the callback while holding the lock and returns its result', async () => {
    const { service } = makeService();
    const result = await service.withLock('lock:room:1', () =>
      Promise.resolve('done'),
    );
    expect(result).toBe('done');
  });

  it('releases the lock after the callback completes, so a later call can acquire it', async () => {
    const { redis, service } = makeService();
    await service.withLock('lock:room:1', () => Promise.resolve(undefined));
    expect(redis.has('lock:room:1')).toBe(false);

    // A second, independent acquisition must succeed now that it's free.
    await expect(
      service.withLock('lock:room:1', () => Promise.resolve('ok')),
    ).resolves.toBe('ok');
  });

  it('releases the lock even when the callback throws', async () => {
    const { redis, service } = makeService();
    await expect(
      service.withLock('lock:room:1', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(redis.has('lock:room:1')).toBe(false);
  });

  it('retries and succeeds once a contended lock is released', async () => {
    const { redis, service } = makeService();
    await redis.set('lock:room:1', 'holder-token', 'PX', 10_000, 'NX');

    const attempt = service.withLock(
      'lock:room:1',
      () => Promise.resolve('acquired'),
      {
        retries: 5,
        retryDelayMs: 5,
      },
    );

    // Release the contended lock shortly after, before retries are exhausted.
    setTimeout(() => void redis.eval('', 1, 'lock:room:1', 'holder-token'), 10);

    await expect(attempt).resolves.toBe('acquired');
  });

  it('throws LockAcquisitionError when the lock is never released', async () => {
    const { redis, service } = makeService();
    await redis.set('lock:room:1', 'someone-else', 'PX', 10_000, 'NX');

    await expect(
      service.withLock('lock:room:1', () => Promise.resolve('never'), {
        retries: 2,
        retryDelayMs: 5,
      }),
    ).rejects.toThrow(LockAcquisitionError);
  });

  it('does not release a lock a different holder has since acquired (stale token safety)', async () => {
    const { redis, service } = makeService();

    await service.withLock('lock:room:1', () => {
      // Simulate: our TTL lapsed mid-operation and another request grabbed the lock.
      redis.forceSet('lock:room:1', 'interloper-token');
      return Promise.resolve(undefined);
    });

    // Our release must not have clobbered the interloper's lock.
    expect(redis.get('lock:room:1')).toBe('interloper-token');
  });
});
