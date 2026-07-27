// Fixed, non-secret test values so the webhook-signature tests are fully
// offline/deterministic — set before the Nest app boots so dotenv (which
// does not override an already-set process.env var) leaves them alone.
process.env.PAYSTACK_SECRET_KEY ??= 'sk_test_e2e_fixed_secret';
process.env.FLUTTERWAVE_WEBHOOK_HASH ??= 'e2e-fixed-webhook-hash';

import { createHmac, randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  BookingDto,
  BranchDto,
  FolioDto,
  InitiatePaymentResponse,
  InvoiceDto,
  LoginResponse,
  RoleDto,
  RoomTypeDto,
  ShiftDto,
  StaffDto,
} from '@nugget/shared-types';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
const STAFF_PASSWORD = 'Password123!';

describe('Billing: folio, invoicing & payments (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let token: string;
  /** A dedicated, freshly-created staff member for shift-attribution
   * assertions — never the shared seed Super Admin, whose shift history
   * would otherwise accumulate across test runs and leave a stray OPEN
   * shift blocking the next run's "open shift" call. */
  let shiftStaffToken: string;
  let roomTypeId: string;
  let ratePlanId: string;

  function todayIso(offsetDays = 0): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  async function createRoom(roomNumber: string) {
    const res = await http
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomTypeId, roomNumber })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function createCheckedOutBooking(
    roomNumber: string,
  ): Promise<BookingDto> {
    const roomId = await createRoom(roomNumber);
    const created = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        ratePlanId,
        checkInDate: todayIso(0),
        checkOutDate: todayIso(1),
        guest: {
          firstName: 'Billing',
          lastName: 'Guest',
          email: `${randomUUID()}@test.local`,
        },
      })
      .expect(201);
    const booking = created.body as BookingDto;
    await http
      .post(`/api/v1/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const checkedOut = await http
      .post(`/api/v1/bookings/${booking.id}/check-out`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return checkedOut.body as BookingDto;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
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
      .send({ name: `Billing Test Branch ${suffix}` })
      .expect(201);
    const branchId = (branchRes.body as BranchDto).id;

    const rolesRes = await http
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // Branch Manager, not Front Desk: this staff member both opens the
    // shift (Front Desk can too) and processes refunds (restricted to
    // Branch Manager/Accountant/Super Admin), so its cash attribution stays
    // on one actor throughout the test.
    const branchManagerRole = (rolesRes.body as RoleDto[]).find(
      (r) => r.name === 'BRANCH_MANAGER',
    );
    if (!branchManagerRole) {
      throw new Error('BRANCH_MANAGER role missing from seed data');
    }
    const shiftStaffRes = await http
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        branchId,
        roleId: branchManagerRole.id,
        email: `billing-shift-staff-${suffix}@test.local`,
        password: STAFF_PASSWORD,
        firstName: 'Billing',
        lastName: 'ShiftStaff',
      })
      .expect(201);
    const shiftStaffLogin = await http
      .post('/api/v1/auth/login')
      .send({
        email: (shiftStaffRes.body as StaffDto).email,
        password: STAFF_PASSWORD,
      })
      .expect(200);
    shiftStaffToken = (shiftStaffLogin.body as LoginResponse).accessToken;

    const roomTypeRes = await http
      .post('/api/v1/room-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ branchId, name: 'Standard', maxOccupancy: 2 })
      .expect(201);
    roomTypeId = (roomTypeRes.body as RoomTypeDto).id;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the full folio -> invoice -> partial payment -> full payment lifecycle', async () => {
    const booking = await createCheckedOutBooking(
      `BILL-${randomUUID().slice(0, 6)}`,
    );

    await http
      .post(`/api/v1/bookings/${booking.id}/folio-charges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Minibar', amount: '25.00' })
      .expect(201);

    const folioRes = await http
      .get(`/api/v1/bookings/${booking.id}/folio`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const folio = folioRes.body as FolioDto;
    expect(Number(folio.totalCharges)).toBe(Number(booking.totalAmount) + 25);
    expect(Number(folio.balanceDue)).toBe(Number(folio.totalCharges));

    const issued = await http
      .post(`/api/v1/bookings/${booking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const invoice = issued.body as InvoiceDto;
    expect(invoice.status).toBe('ISSUED');
    expect(invoice.paymentStatus).toBe('UNPAID');
    expect(Number(invoice.totalAmount)).toBe(Number(folio.totalCharges));

    await http
      .post(`/api/v1/bookings/${booking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    const openedShift = await http
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .send({ openingCash: '0.00' })
      .expect(201);
    const shiftId = (openedShift.body as ShiftDto).id;

    const halfAmount = (Number(invoice.totalAmount) / 2).toFixed(2);
    const partialPaymentRes = await http
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .send({ method: 'CASH', amount: halfAmount })
      .expect(201);
    const partialPayment = (partialPaymentRes.body as InitiatePaymentResponse)
      .payment;
    expect(partialPayment.status).toBe('SUCCESSFUL');
    expect(
      (partialPaymentRes.body as InitiatePaymentResponse).authorizationUrl,
    ).toBeUndefined();

    const afterPartial = await http
      .get(`/api/v1/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((afterPartial.body as InvoiceDto).paymentStatus).toBe(
      'PARTIALLY_PAID',
    );
    expect(Number((afterPartial.body as InvoiceDto).balanceDue)).toBeCloseTo(
      Number(invoice.totalAmount) - Number(halfAmount),
      2,
    );

    const shiftAfterCash = await http
      .get(`/api/v1/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .expect(200);
    const shiftTransactions = (shiftAfterCash.body as ShiftDto).transactions;
    expect(
      shiftTransactions.some(
        (t) => t.type === 'CASH_IN' && Number(t.amount) === Number(halfAmount),
      ),
    ).toBe(true);

    const remaining = (
      Number(invoice.totalAmount) - Number(halfAmount)
    ).toFixed(2);

    await http
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'CASH', amount: (Number(remaining) + 1).toFixed(2) })
      .expect(400);

    await http
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'CARD', amount: remaining })
      .expect(201);

    const afterFull = await http
      .get(`/api/v1/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((afterFull.body as InvoiceDto).paymentStatus).toBe('PAID');
    expect(Number((afterFull.body as InvoiceDto).balanceDue)).toBe(0);

    await http
      .post(`/api/v1/invoices/${invoice.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    const cashPaymentId = partialPayment.id;
    const partialRefund = await http
      .post(`/api/v1/payments/${cashPaymentId}/refund`)
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .send({ amount: '5.00', reason: 'Guest complaint' })
      .expect(201);
    expect(Number((partialRefund.body as { amount: string }).amount)).toBe(5);
    expect((partialRefund.body as { status: string }).status).toBe(
      'SUCCESSFUL',
    );

    const afterRefund = await http
      .get(`/api/v1/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((afterRefund.body as InvoiceDto).paymentStatus).toBe(
      'PARTIALLY_PAID',
    );
    expect(Number((afterRefund.body as InvoiceDto).balanceDue)).toBeCloseTo(
      5,
      2,
    );

    const shiftAfterRefund = await http
      .get(`/api/v1/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .expect(200);
    expect(
      (shiftAfterRefund.body as ShiftDto).transactions.some(
        (t) => t.type === 'CASH_OUT' && Number(t.amount) === 5,
      ),
    ).toBe(true);

    const overRefundAmount = (Number(halfAmount) - 5 + 1).toFixed(2);
    await http
      .post(`/api/v1/payments/${cashPaymentId}/refund`)
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .send({ amount: overRefundAmount })
      .expect(400);

    const finalRefundAmount = (Number(halfAmount) - 5).toFixed(2);
    const finalRefund = await http
      .post(`/api/v1/payments/${cashPaymentId}/refund`)
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .send({ amount: finalRefundAmount })
      .expect(201);
    expect(finalRefund.body).toMatchObject({ status: 'SUCCESSFUL' });

    const paymentAfterFullRefund = await http
      .get(`/api/v1/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const cashPaymentDto = (
      paymentAfterFullRefund.body as InvoiceDto
    ).payments.find((p) => p.id === cashPaymentId);
    expect(cashPaymentDto?.status).toBe('REFUNDED');

    await http
      .post(`/api/v1/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${shiftStaffToken}`)
      .send({ closingCashActual: '0.00' })
      .expect(201);
  });

  it('rejects a payment amount of zero', async () => {
    const booking = await createCheckedOutBooking(
      `ZERO-${randomUUID().slice(0, 6)}`,
    );
    const issued = await http
      .post(`/api/v1/bookings/${booking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const invoice = issued.body as InvoiceDto;

    await http
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'CASH', amount: '0.00' })
      .expect(400);
  });

  it('allows voiding an unpaid invoice, and reissuing after voiding', async () => {
    const booking = await createCheckedOutBooking(
      `VOID-${randomUUID().slice(0, 6)}`,
    );
    const issued = await http
      .post(`/api/v1/bookings/${booking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const invoice = issued.body as InvoiceDto;

    const voided = await http
      .post(`/api/v1/invoices/${invoice.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect((voided.body as InvoiceDto).status).toBe('VOID');

    const reissued = await http
      .post(`/api/v1/bookings/${booking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect((reissued.body as InvoiceDto).status).toBe('ISSUED');
  });

  it('rejects adding a folio charge to a cancelled booking', async () => {
    const roomId = await createRoom(`CXL-${randomUUID().slice(0, 6)}`);
    const created = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        ratePlanId,
        checkInDate: todayIso(5),
        checkOutDate: todayIso(6),
        guest: {
          firstName: 'Cancel',
          lastName: 'Guest',
          email: `${randomUUID()}@test.local`,
        },
      })
      .expect(201);
    const booking = created.body as BookingDto;
    await http
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .post(`/api/v1/bookings/${booking.id}/folio-charges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Late fee', amount: '10.00' })
      .expect(400);
  });

  it('generates a downloadable invoice PDF and payment receipt PDF', async () => {
    const booking = await createCheckedOutBooking(
      `PDF-${randomUUID().slice(0, 6)}`,
    );
    const issued = await http
      .post(`/api/v1/bookings/${booking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const invoice = issued.body as InvoiceDto;

    const paymentRes = await http
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'CARD', amount: invoice.totalAmount })
      .expect(201);
    const payment = (paymentRes.body as InitiatePaymentResponse).payment;

    const invoicePdf = await http
      .get(`/api/v1/invoices/${invoice.id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(invoicePdf.headers['content-type']).toContain('application/pdf');
    expect((invoicePdf.body as Buffer).length).toBeGreaterThan(0);

    const receiptPdf = await http
      .get(`/api/v1/payments/${payment.id}/receipt.pdf`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(receiptPdf.headers['content-type']).toContain('application/pdf');
  });

  it('rejects initiating a Flutterwave payment when FLUTTERWAVE_SECRET_KEY is not configured', async () => {
    const booking = await createCheckedOutBooking(
      `FLW-${randomUUID().slice(0, 6)}`,
    );
    const issued = await http
      .post(`/api/v1/bookings/${booking.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const invoice = issued.body as InvoiceDto;

    await http
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        method: 'CARD',
        provider: 'FLUTTERWAVE',
        amount: invoice.totalAmount,
      })
      .expect(500);
  });

  describe('webhook signature verification', () => {
    it('rejects a Paystack webhook with an invalid signature', () => {
      const body = JSON.stringify({
        event: 'charge.success',
        data: { reference: 'unknown' },
      });
      return http
        .post('/api/v1/webhooks/paystack')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', 'not-the-real-signature')
        .send(body)
        .expect(401);
    });

    it('accepts a validly-signed Paystack webhook and no-ops on an unknown reference', () => {
      const payload = {
        event: 'charge.success',
        data: { reference: `unknown-${randomUUID()}` },
      };
      const body = JSON.stringify(payload);
      const signature = createHmac(
        'sha512',
        process.env.PAYSTACK_SECRET_KEY as string,
      )
        .update(Buffer.from(body))
        .digest('hex');

      return http
        .post('/api/v1/webhooks/paystack')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', signature)
        .send(body)
        .expect(200)
        .expect({ received: true });
    });

    it('rejects a Flutterwave webhook with an invalid verif-hash', () => {
      const body = JSON.stringify({
        event: 'charge.completed',
        data: { tx_ref: 'unknown' },
      });
      return http
        .post('/api/v1/webhooks/flutterwave')
        .set('Content-Type', 'application/json')
        .set('verif-hash', 'not-the-real-hash')
        .send(body)
        .expect(401);
    });

    it('accepts a Flutterwave webhook with the correct verif-hash and no-ops on an unknown reference', () => {
      const payload = {
        event: 'charge.completed',
        data: { tx_ref: `unknown-${randomUUID()}` },
      };
      const body = JSON.stringify(payload);

      return http
        .post('/api/v1/webhooks/flutterwave')
        .set('Content-Type', 'application/json')
        .set('verif-hash', process.env.FLUTTERWAVE_WEBHOOK_HASH as string)
        .send(body)
        .expect(200)
        .expect({ received: true });
    });
  });
});
