import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AvailableRoomDto,
  BookingDto,
  LoginResponse,
  RoomTypeDto,
} from '@nugget/shared-types';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Proves Milestone 2's Definition of Done directly: "two simultaneous
 * booking attempts on the same room/date cannot both succeed, proven by
 * test, not just manual QA." Runs against real Postgres + real Redis (via
 * the full Nest app), firing genuinely concurrent HTTP requests rather than
 * calling the service in-process, so the Redis lock and the Postgres
 * row-locked transaction are both actually exercised.
 */
describe('Booking concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let branchId: string;
  let roomTypeId: string;

  async function createRoom(roomNumber: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomTypeId, roomNumber })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function createRatePlan() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rate-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomTypeId,
        name: 'Standard',
        type: 'STANDARD',
        pricePerNight: '100.00',
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  function attemptBooking(
    roomId: string,
    ratePlanId: string,
    checkInDate: string,
    checkOutDate: string,
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        ratePlanId,
        checkInDate,
        checkOutDate,
        guest: {
          firstName: 'Concurrent',
          lastName: 'Guest',
          email: `${randomUUID()}@test.local`,
        },
      });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = randomUUID().slice(0, 8);
    const http = request(app.getHttpServer());

    const login = await http
      .post('/api/v1/auth/login')
      .send({
        email: SEED_SUPER_ADMIN_EMAIL,
        password: SEED_SUPER_ADMIN_PASSWORD,
      })
      .expect(200);
    token = (login.body as LoginResponse).accessToken;

    const branchRes = await http
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Concurrency Test Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as { id: string }).id;

    const roomTypeRes = await http
      .post('/api/v1/room-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ branchId, name: 'Standard', maxOccupancy: 2 })
      .expect(201);
    roomTypeId = (roomTypeRes.body as RoomTypeDto).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects one of two identical concurrent booking attempts on the same room/dates', async () => {
    const roomId = await createRoom(`ID-${randomUUID().slice(0, 6)}`);
    const ratePlanId = await createRatePlan();

    const [a, b] = await Promise.all([
      attemptBooking(roomId, ratePlanId, '2027-01-10', '2027-01-15'),
      attemptBooking(roomId, ratePlanId, '2027-01-10', '2027-01-15'),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const bookings = await prisma.booking.findMany({ where: { roomId } });
    expect(bookings).toHaveLength(1);
  });

  it('rejects one of two concurrent attempts with merely overlapping (not identical) ranges', async () => {
    const roomId = await createRoom(`OV-${randomUUID().slice(0, 6)}`);
    const ratePlanId = await createRatePlan();

    const [a, b] = await Promise.all([
      attemptBooking(roomId, ratePlanId, '2027-02-01', '2027-02-05'),
      attemptBooking(roomId, ratePlanId, '2027-02-03', '2027-02-07'),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const bookings = await prisma.booking.findMany({ where: { roomId } });
    expect(bookings).toHaveLength(1);
  });

  it('allows concurrent bookings on the same room for genuinely non-overlapping dates', async () => {
    const roomId = await createRoom(`NO-${randomUUID().slice(0, 6)}`);
    const ratePlanId = await createRatePlan();

    const [a, b] = await Promise.all([
      attemptBooking(roomId, ratePlanId, '2027-03-01', '2027-03-03'),
      attemptBooking(roomId, ratePlanId, '2027-03-10', '2027-03-12'),
    ]);

    expect([a.status, b.status]).toEqual([201, 201]);

    const bookings = await prisma.booking.findMany({ where: { roomId } });
    expect(bookings).toHaveLength(2);
  });

  it('holds up under five simultaneous attempts on one room/date — exactly one wins', async () => {
    const roomId = await createRoom(`FIVE-${randomUUID().slice(0, 6)}`);
    const ratePlanId = await createRatePlan();

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        attemptBooking(roomId, ratePlanId, '2027-04-01', '2027-04-04'),
      ),
    );

    const succeeded = attempts.filter((r) => r.status === 201);
    const rejected = attempts.filter((r) => r.status === 409);
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    const bookings = await prisma.booking.findMany({ where: { roomId } });
    expect(bookings).toHaveLength(1);
  });

  it('does not let an expired HELD booking block a new one for the same dates', async () => {
    const roomId = await createRoom(`EXP-${randomUUID().slice(0, 6)}`);
    const ratePlanId = await createRatePlan();

    const first = await attemptBooking(
      roomId,
      ratePlanId,
      '2027-05-01',
      '2027-05-03',
    );
    expect(first.status).toBe(201);
    const firstBooking = first.body as BookingDto;

    // Force the hold into the past rather than waiting out BOOKING_HOLD_MINUTES.
    await prisma.booking.update({
      where: { id: firstBooking.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });

    const availability = await request(app.getHttpServer())
      .get('/api/v1/bookings/availability')
      .set('Authorization', `Bearer ${token}`)
      .query({
        branchId,
        checkInDate: '2027-05-01',
        checkOutDate: '2027-05-03',
      })
      .expect(200);
    expect(
      (availability.body as AvailableRoomDto[]).some((r) => r.id === roomId),
    ).toBe(true);

    const second = await attemptBooking(
      roomId,
      ratePlanId,
      '2027-05-01',
      '2027-05-03',
    );
    expect(second.status).toBe(201);
  });
});
