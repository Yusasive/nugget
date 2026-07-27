import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { LoginResponse, TourDepartureDto } from '@nugget/shared-types';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Proves Milestone 6's Definition of Done directly: "an overlapping
 * guide/vehicle double-booking is rejected." Runs against real Postgres +
 * real Redis (via the full Nest app), firing genuinely concurrent HTTP
 * requests rather than calling the service in-process, the same rigor
 * booking-concurrency.e2e-spec.ts applies to Milestone 2's room locking.
 */
describe('Tour departure scheduling concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let branchId: string;
  let tourPackageId: string;

  async function createGuide() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tour-guides')
      .set('Authorization', `Bearer ${token}`)
      .send({ branchId, fullName: `Guide ${randomUUID().slice(0, 6)}` })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function createVehicle() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        branchId,
        name: `Vehicle ${randomUUID().slice(0, 6)}`,
        capacity: 10,
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  function attemptDeparture(
    guideId: string,
    vehicleId: string,
    departureAt: string,
    returnAt: string,
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/tour-departures')
      .set('Authorization', `Bearer ${token}`)
      .send({ tourPackageId, guideId, vehicleId, departureAt, returnAt });
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
      .send({ name: `Tour Scheduling Test Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as { id: string }).id;

    const packageRes = await http
      .post('/api/v1/tour-packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        branchId,
        name: `Test Package ${suffix}`,
        durationMinutes: 180,
        defaultPricePerSeat: '50.00',
        defaultCapacity: 10,
      })
      .expect(201);
    tourPackageId = (packageRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects one of two concurrent departures sharing the same guide with overlapping times', async () => {
    const guideId = await createGuide();
    const [vehicleA, vehicleB] = await Promise.all([
      createVehicle(),
      createVehicle(),
    ]);

    const [a, b] = await Promise.all([
      attemptDeparture(
        guideId,
        vehicleA,
        '2027-01-10T09:00:00Z',
        '2027-01-10T12:00:00Z',
      ),
      attemptDeparture(
        guideId,
        vehicleB,
        '2027-01-10T10:00:00Z',
        '2027-01-10T13:00:00Z',
      ),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const departures = await prisma.tourDeparture.findMany({
      where: { guideId, status: 'SCHEDULED' },
    });
    expect(departures).toHaveLength(1);
  });

  it('rejects one of two concurrent departures sharing the same vehicle with overlapping times', async () => {
    const vehicleId = await createVehicle();
    const [guideA, guideB] = await Promise.all([createGuide(), createGuide()]);

    const [a, b] = await Promise.all([
      attemptDeparture(
        guideA,
        vehicleId,
        '2027-02-01T09:00:00Z',
        '2027-02-01T12:00:00Z',
      ),
      attemptDeparture(
        guideB,
        vehicleId,
        '2027-02-01T11:00:00Z',
        '2027-02-01T14:00:00Z',
      ),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const departures = await prisma.tourDeparture.findMany({
      where: { vehicleId, status: 'SCHEDULED' },
    });
    expect(departures).toHaveLength(1);
  });

  it('allows the same guide and vehicle on two genuinely non-overlapping departures', async () => {
    const guideId = await createGuide();
    const vehicleId = await createVehicle();

    const [a, b] = await Promise.all([
      attemptDeparture(
        guideId,
        vehicleId,
        '2027-03-01T09:00:00Z',
        '2027-03-01T12:00:00Z',
      ),
      attemptDeparture(
        guideId,
        vehicleId,
        '2027-03-01T14:00:00Z',
        '2027-03-01T17:00:00Z',
      ),
    ]);

    expect([a.status, b.status]).toEqual([201, 201]);

    const departures = await prisma.tourDeparture.findMany({
      where: { guideId, vehicleId, status: 'SCHEDULED' },
    });
    expect(departures).toHaveLength(2);
  });

  it('holds up under five simultaneous attempts on one guide/vehicle — exactly one wins', async () => {
    const guideId = await createGuide();
    const vehicleId = await createVehicle();

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        attemptDeparture(
          guideId,
          vehicleId,
          '2027-04-01T09:00:00Z',
          '2027-04-01T12:00:00Z',
        ),
      ),
    );

    const succeeded = attempts.filter((r) => r.status === 201);
    const rejected = attempts.filter((r) => r.status === 409);
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    const departures = await prisma.tourDeparture.findMany({
      where: { guideId, vehicleId, status: 'SCHEDULED' },
    });
    expect(departures).toHaveLength(1);
  });

  it('exposes the created departure with totalSeats defaulted from the package', async () => {
    const guideId = await createGuide();
    const vehicleId = await createVehicle();

    const res = await attemptDeparture(
      guideId,
      vehicleId,
      '2027-05-01T09:00:00Z',
      '2027-05-01T12:00:00Z',
    ).expect(201);

    const dto = res.body as TourDepartureDto;
    expect(dto.totalSeats).toBe(10);
    expect(dto.availableSeats).toBe(10);
    expect(Number(dto.pricePerSeat)).toBe(50);
  });
});
