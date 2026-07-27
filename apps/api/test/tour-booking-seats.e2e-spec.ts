import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { LoginResponse, TourBookingDto } from '@nugget/shared-types';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Proves Milestone 6's Definition of Done directly: "a guest books a tour
 * departure, seats decrement correctly." Mirrors
 * booking-concurrency.e2e-spec.ts's rigor: real Postgres + real Redis via
 * the full Nest app, genuinely concurrent HTTP requests, and a final-state
 * DB assertion rather than trusting individual response codes alone.
 */
describe('Tour booking seat concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let branchId: string;
  let tourPackageId: string;

  async function createDeparture(totalSeats: number) {
    const [guideRes, vehicleRes] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/tour-guides')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId, fullName: `Guide ${randomUUID().slice(0, 6)}` })
        .expect(201),
      request(app.getHttpServer())
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          branchId,
          name: `Vehicle ${randomUUID().slice(0, 6)}`,
          capacity: totalSeats,
        })
        .expect(201),
    ]);

    // Distinct guide/vehicle per call means no overlap risk between calls —
    // a fixed same-day range keeps the range itself always valid.
    const day = String(10 + Math.floor(Math.random() * 15)).padStart(2, '0');
    const res = await request(app.getHttpServer())
      .post('/api/v1/tour-departures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tourPackageId,
        guideId: (guideRes.body as { id: string }).id,
        vehicleId: (vehicleRes.body as { id: string }).id,
        departureAt: `2027-06-${day}T09:00:00Z`,
        returnAt: `2027-06-${day}T18:00:00Z`,
        totalSeats,
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  function attemptBooking(tourDepartureId: string, seats: number) {
    return request(app.getHttpServer())
      .post('/api/v1/tour-bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tourDepartureId,
        seats,
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
      .send({ name: `Tour Booking Seats Test Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as { id: string }).id;

    const packageRes = await http
      .post('/api/v1/tour-packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        branchId,
        name: `Test Package ${suffix}`,
        durationMinutes: 180,
        defaultPricePerSeat: '25.00',
        defaultCapacity: 5,
      })
      .expect(201);
    tourPackageId = (packageRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('holds up under five concurrent 2-seat bookings against a 5-seat departure — total booked never exceeds capacity', async () => {
    const departureId = await createDeparture(5);

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => attemptBooking(departureId, 2)),
    );

    const succeeded = attempts.filter((r) => r.status === 201);
    const rejected = attempts.filter((r) => r.status === 409);
    expect(succeeded.length + rejected.length).toBe(5);
    // At most two 2-seat bookings can fit in 5 seats.
    expect(succeeded.length).toBeLessThanOrEqual(2);

    const activeBookings = await prisma.tourBooking.findMany({
      where: {
        tourDepartureId: departureId,
        status: { in: ['HELD', 'CONFIRMED'] },
      },
    });
    const totalBookedSeats = activeBookings.reduce(
      (sum, b) => sum + b.seats,
      0,
    );
    expect(totalBookedSeats).toBeLessThanOrEqual(5);
    expect(totalBookedSeats).toBe(succeeded.length * 2);
  });

  it('rejects a single request that would overbook a departure singlehandedly', async () => {
    const departureId = await createDeparture(3);

    const res = await attemptBooking(departureId, 4);
    expect(res.status).toBe(409);

    const bookings = await prisma.tourBooking.findMany({
      where: { tourDepartureId: departureId },
    });
    expect(bookings).toHaveLength(0);
  });

  it('does not let an expired HELD tour booking block a new one for the same seats', async () => {
    const departureId = await createDeparture(2);

    const first = await attemptBooking(departureId, 2).expect(201);
    const firstBooking = first.body as TourBookingDto;

    // Force the hold into the past rather than waiting out BOOKING_HOLD_MINUTES.
    await prisma.tourBooking.update({
      where: { id: firstBooking.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });

    const second = await attemptBooking(departureId, 2);
    expect(second.status).toBe(201);
  });

  it('confirming a booking decrements availableSeats as reported by the API', async () => {
    const departureId = await createDeparture(4);

    const created = await attemptBooking(departureId, 3).expect(201);
    const booking = created.body as TourBookingDto;
    expect(booking.tourDeparture.availableSeats).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/tour-bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const departureRes = await request(app.getHttpServer())
      .get(`/api/v1/tour-departures/${departureId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (departureRes.body as { availableSeats: number }).availableSeats,
    ).toBe(1);
  });
});
