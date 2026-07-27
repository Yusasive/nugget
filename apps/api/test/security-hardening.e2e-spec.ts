import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';

/**
 * Milestone 14 — Security Hardening
 *
 * Proves the auth endpoint's brute-force throttle (10 req/min) is active
 * and cannot be bypassed. The ThrottlerStorage is NOT overridden here —
 * that's the whole point.
 */
describe('Security hardening (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after exceeding the auth endpoint rate limit (10 req/min)', async () => {
    const http = request(app.getHttpServer());

    // Fire 11 login attempts in rapid succession. The first 10 are allowed
    // (regardless of whether the credentials are valid); the 11th must be
    // throttled. Using a wrong password so we never accidentally consume a
    // real session or trigger account-lockout logic.
    const attempts = await Promise.all(
      Array.from({ length: 11 }, () =>
        http
          .post('/api/v1/auth/login')
          .send({ email: SEED_SUPER_ADMIN_EMAIL, password: 'wrong-password-for-throttle-test' }),
      ),
    );

    const statuses = attempts.map((r) => r.status);
    expect(statuses).toContain(429);

    // All non-throttled responses must be 401 (bad credentials), never 200.
    const nonThrottled = statuses.filter((s) => s !== 429);
    expect(nonThrottled.every((s) => s === 401)).toBe(true);
  });
});
