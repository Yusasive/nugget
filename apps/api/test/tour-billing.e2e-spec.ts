import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  BookingDto,
  FolioDto,
  InvoiceDto,
  LoginResponse,
  TourBookingDto,
} from '@nugget/shared-types';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Proves Milestone 6's two billing paths: a tour bundled with a room stay
 * rides that booking's folio (a FolioCharge, category TOUR — no invoice of
 * its own), while a standalone tour booking gets its own Invoice, both
 * reusing Milestone 5's billing machinery rather than a parallel system.
 */
describe('Tour billing: bundled folio charge vs. standalone invoice (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let token: string;
  let branchId: string;
  let roomTypeId: string;
  let ratePlanId: string;
  let tourPackageId: string;

  function todayIso(offsetDays = 0): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  async function createConfirmedRoomBooking(
    roomNumber: string,
  ): Promise<BookingDto> {
    const roomRes = await http
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomTypeId, roomNumber })
      .expect(201);
    const roomId = (roomRes.body as { id: string }).id;

    const created = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        ratePlanId,
        checkInDate: todayIso(0),
        checkOutDate: todayIso(1),
        guest: {
          firstName: 'Tour',
          lastName: 'Guest',
          email: `${randomUUID()}@test.local`,
        },
      })
      .expect(201);
    const booking = created.body as BookingDto;
    const confirmed = await http
      .post(`/api/v1/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return confirmed.body as BookingDto;
  }

  async function createConfirmedTourBooking(
    linkedBookingId?: string,
  ): Promise<TourBookingDto> {
    const [guideRes, vehicleRes] = await Promise.all([
      http
        .post('/api/v1/tour-guides')
        .set('Authorization', `Bearer ${token}`)
        .send({ branchId, fullName: `Guide ${randomUUID().slice(0, 6)}` })
        .expect(201),
      http
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          branchId,
          name: `Vehicle ${randomUUID().slice(0, 6)}`,
          capacity: 10,
        })
        .expect(201),
    ]);
    const day = String(10 + Math.floor(Math.random() * 15)).padStart(2, '0');
    const departureRes = await http
      .post('/api/v1/tour-departures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tourPackageId,
        guideId: (guideRes.body as { id: string }).id,
        vehicleId: (vehicleRes.body as { id: string }).id,
        departureAt: `2027-07-${day}T09:00:00Z`,
        returnAt: `2027-07-${day}T18:00:00Z`,
      })
      .expect(201);

    const created = await http
      .post('/api/v1/tour-bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tourDepartureId: (departureRes.body as { id: string }).id,
        seats: 2,
        guest: {
          firstName: 'Tour',
          lastName: 'Guest',
          email: `${randomUUID()}@test.local`,
        },
        ...(linkedBookingId ? { linkedBookingId } : {}),
      })
      .expect(201);
    const booking = created.body as TourBookingDto;

    const confirmed = await http
      .post(`/api/v1/tour-bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return confirmed.body as TourBookingDto;
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
    http = request(app.getHttpServer());

    const suffix = randomUUID().slice(0, 8);

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
      .send({ name: `Tour Billing Test Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as { id: string }).id;

    const roomTypeRes = await http
      .post('/api/v1/room-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ branchId, name: 'Standard', maxOccupancy: 2 })
      .expect(201);
    roomTypeId = (roomTypeRes.body as { id: string }).id;

    const ratePlanRes = await http
      .post('/api/v1/rate-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomTypeId,
        name: 'Standard',
        type: 'STANDARD',
        pricePerNight: '100.00',
      })
      .expect(201);
    ratePlanId = (ratePlanRes.body as { id: string }).id;

    const packageRes = await http
      .post('/api/v1/tour-packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        branchId,
        name: `Test Package ${suffix}`,
        durationMinutes: 180,
        defaultPricePerSeat: '30.00',
        defaultCapacity: 10,
      })
      .expect(201);
    tourPackageId = (packageRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('bundled: confirming a tour booking with linkedBookingId lands a TOUR folio charge on the room booking', async () => {
    const roomBooking = await createConfirmedRoomBooking(
      `TB-${randomUUID().slice(0, 6)}`,
    );
    const tourBooking = await createConfirmedTourBooking(roomBooking.id);

    expect(tourBooking.linkedBookingId).toBe(roomBooking.id);

    const folioRes = await http
      .get(`/api/v1/bookings/${roomBooking.id}/folio`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const folio = folioRes.body as FolioDto;
    const tourCharge = folio.charges.find((c) => c.category === 'TOUR');
    expect(tourCharge).toBeDefined();
    expect(Number(tourCharge!.amount)).toBe(Number(tourBooking.totalAmount));
  });

  it('standalone: a confirmed tour booking with no linkedBookingId can be invoiced and paid on its own', async () => {
    const tourBooking = await createConfirmedTourBooking();
    expect(tourBooking.linkedBookingId).toBeNull();

    const invoiceRes = await http
      .post(`/api/v1/tour-bookings/${tourBooking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const invoice: InvoiceDto = invoiceRes.body as InvoiceDto;
    expect(invoice.bookingId).toBeNull();
    expect(invoice.tourBookingId).toBe(tourBooking.id);
    expect(Number(invoice.totalAmount)).toBe(Number(tourBooking.totalAmount));

    const paymentRes = await http
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'CASH', amount: tourBooking.totalAmount })
      .expect(201);
    expect((paymentRes.body as { payment: { status: string } }).payment.status).toBe('SUCCESSFUL');
  });

  it('rejects issuing a standalone invoice for a bundled tour booking', async () => {
    const roomBooking = await createConfirmedRoomBooking(
      `TB-${randomUUID().slice(0, 6)}`,
    );
    const tourBooking = await createConfirmedTourBooking(roomBooking.id);

    await http
      .post(`/api/v1/tour-bookings/${tourBooking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rejects a tour invoice PDF export with a clear error rather than crashing', async () => {
    const tourBooking = await createConfirmedTourBooking();
    const invoiceRes = await http
      .post(`/api/v1/tour-bookings/${tourBooking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const invoice: InvoiceDto = invoiceRes.body as InvoiceDto;

    await http
      .get(`/api/v1/invoices/${invoice.id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('lets a Tours Coordinator issue an invoice and record a payment for their own tour booking without hotel-billing access', async () => {
    const rolesRes = await http
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const coordinatorRole = (rolesRes.body as { id: string; name: string }[]).find(
      (r) => r.name === 'TOURS_COORDINATOR',
    );
    if (!coordinatorRole) {
      throw new Error('TOURS_COORDINATOR role missing from seed data');
    }

    const staffRes = await http
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        branchId,
        roleId: coordinatorRole.id,
        email: `tours-coordinator-${randomUUID().slice(0, 8)}@test.local`,
        password: 'Password123!',
        firstName: 'Tours',
        lastName: 'Coordinator',
      })
      .expect(201);
    const coordinatorLogin = await http
      .post('/api/v1/auth/login')
      .send({ email: (staffRes.body as { email: string }).email, password: 'Password123!' })
      .expect(200);
    const coordinatorToken = (coordinatorLogin.body as LoginResponse).accessToken;

    // Prove the shared hotel-billing endpoint is still off-limits...
    await http
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .expect(403);

    // ...while the tour-scoped equivalents work end-to-end for their own module.
    const tourBooking = await createConfirmedTourBooking();
    const invoiceRes = await http
      .post(`/api/v1/tour-bookings/${tourBooking.id}/invoices`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .expect(201);
    const invoice: InvoiceDto = invoiceRes.body as InvoiceDto;

    const paymentRes = await http
      .post(`/api/v1/tour-bookings/${tourBooking.id}/payments`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ method: 'CASH', amount: tourBooking.totalAmount })
      .expect(201);
    expect((paymentRes.body as { payment: { status: string } }).payment.status).toBe('SUCCESSFUL');

    const latest = await http
      .get(`/api/v1/tour-bookings/${tourBooking.id}/invoice`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .expect(200);
    const latestInvoice: InvoiceDto = latest.body as InvoiceDto;
    expect(latestInvoice.id).toBe(invoice.id);
    expect(latestInvoice.paymentStatus).toBe('PAID');
  });
});
