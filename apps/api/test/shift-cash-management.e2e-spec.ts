import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  BookingDto,
  BranchDto,
  LoginResponse,
  PaginatedResponse,
  RoleDto,
  RoomTypeDto,
  ShiftDto,
} from '@nugget/shared-types';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
const STAFF_PASSWORD = 'Password123!';

/**
 * Proves Milestone 4's Definition of Done directly: "a Front Desk user opens
 * a shift, takes several payments through the day, closes the shift, and
 * the reconciliation correctly flags any discrepancy between expected and
 * actual cash" — plus the TRD §5 rule that a Front Desk staff member's cash
 * report is visible only to them (and Accountant/Manager/Super Admin), never
 * to another Front Desk staff member.
 */
describe('Shift & cash management (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let superAdminToken: string;
  let staffAToken: string;
  let staffBToken: string;
  let accountantToken: string;
  let branchId: string;
  let roomTypeId: string;
  let ratePlanId: string;

  async function openShift(token: string, openingCash: string) {
    const res = await http
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ openingCash })
      .expect(201);
    return res.body as ShiftDto;
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

    const superAdminLogin = await http
      .post('/api/v1/auth/login')
      .send({
        email: SEED_SUPER_ADMIN_EMAIL,
        password: SEED_SUPER_ADMIN_PASSWORD,
      })
      .expect(200);
    superAdminToken = (superAdminLogin.body as LoginResponse).accessToken;

    const rolesRes = await http
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    const roles = rolesRes.body as RoleDto[];
    const frontDeskRole = roles.find((r) => r.name === 'FRONT_DESK');
    const accountantRole = roles.find((r) => r.name === 'ACCOUNTANT');
    if (!frontDeskRole || !accountantRole) {
      throw new Error('FRONT_DESK/ACCOUNTANT role missing from seed data');
    }

    const branchRes = await http
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: `Shift Test Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as BranchDto).id;

    // Independent staff creations/logins run in parallel — this hook already
    // does more argon2 hashing (a deliberately slow, memory-hard operation)
    // than other e2e suites' setup, so serializing all of it risks tripping
    // Jest's default hook timeout under load from other parallel workers.
    const [, , , roomTypeRes] = await Promise.all([
      http
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          branchId,
          roleId: frontDeskRole.id,
          email: `front-desk-a-${suffix}@test.local`,
          password: STAFF_PASSWORD,
          firstName: 'FrontDesk',
          lastName: 'A',
        })
        .expect(201),
      http
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          branchId,
          roleId: frontDeskRole.id,
          email: `front-desk-b-${suffix}@test.local`,
          password: STAFF_PASSWORD,
          firstName: 'FrontDesk',
          lastName: 'B',
        })
        .expect(201),
      http
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          branchId,
          roleId: accountantRole.id,
          email: `accountant-${suffix}@test.local`,
          password: STAFF_PASSWORD,
          firstName: 'Cash',
          lastName: 'Accountant',
        })
        .expect(201),
      http
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ branchId, name: 'Standard', maxOccupancy: 2 })
        .expect(201),
    ]);
    roomTypeId = (roomTypeRes.body as RoomTypeDto).id;

    const [staffALogin, staffBLogin, accountantLogin, ratePlanRes] =
      await Promise.all([
        http
          .post('/api/v1/auth/login')
          .send({
            email: `front-desk-a-${suffix}@test.local`,
            password: STAFF_PASSWORD,
          })
          .expect(200),
        http
          .post('/api/v1/auth/login')
          .send({
            email: `front-desk-b-${suffix}@test.local`,
            password: STAFF_PASSWORD,
          })
          .expect(200),
        http
          .post('/api/v1/auth/login')
          .send({
            email: `accountant-${suffix}@test.local`,
            password: STAFF_PASSWORD,
          })
          .expect(200),
        http
          .post('/api/v1/rate-plans')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            roomTypeId,
            name: 'Standard',
            type: 'STANDARD',
            pricePerNight: '100.00',
          })
          .expect(201),
      ]);
    staffAToken = (staffALogin.body as LoginResponse).accessToken;
    staffBToken = (staffBLogin.body as LoginResponse).accessToken;
    accountantToken = (accountantLogin.body as LoginResponse).accessToken;
    ratePlanId = (ratePlanRes.body as { id: string }).id;
  }, 20000);

  afterAll(async () => {
    await app.close();
  });

  it('runs the full open -> several payments -> close lifecycle with zero discrepancy', async () => {
    const shift = await openShift(staffAToken, '5000.00');
    expect(shift.status).toBe('OPEN');
    expect(Number(shift.openingCash)).toBe(5000);

    await http
      .post(`/api/v1/shifts/${shift.id}/transactions`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({
        type: 'CASH_IN',
        amount: '1500.00',
        description: 'Room 101 payment',
      })
      .expect(201);
    await http
      .post(`/api/v1/shifts/${shift.id}/transactions`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({
        type: 'CASH_IN',
        amount: '2000.00',
        description: 'Room 102 payment',
      })
      .expect(201);
    const afterThree = await http
      .post(`/api/v1/shifts/${shift.id}/transactions`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({
        type: 'CASH_OUT',
        amount: '300.00',
        description: 'Petty cash for supplies',
      })
      .expect(201);
    expect((afterThree.body as ShiftDto).transactions).toHaveLength(3);

    // 5000 opening + 1500 + 2000 - 300 = 8200 expected.
    const closed = await http
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ closingCashActual: '8200.00' })
      .expect(201);
    const closedDto = closed.body as ShiftDto;
    expect(closedDto.status).toBe('CLOSED');
    expect(Number(closedDto.closingCashExpected)).toBe(8200);
    expect(Number(closedDto.cashReport?.discrepancy)).toBe(0);
    expect(Number(closedDto.cashReport?.totalCashCollected)).toBe(3200);
  });

  it('flags a positive discrepancy when the drawer has more cash than expected', async () => {
    const shift = await openShift(staffBToken, '1000.00');
    await http
      .post(`/api/v1/shifts/${shift.id}/transactions`)
      .set('Authorization', `Bearer ${staffBToken}`)
      .send({ type: 'CASH_IN', amount: '500.00' })
      .expect(201);

    // Expected = 1500; actual = 1550 -> +50 discrepancy.
    const closed = await http
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set('Authorization', `Bearer ${staffBToken}`)
      .send({ closingCashActual: '1550.00' })
      .expect(201);
    expect(Number((closed.body as ShiftDto).cashReport?.discrepancy)).toBe(50);
  });

  it('rejects opening a second shift while one is already open', async () => {
    await openShift(staffAToken, '1000.00');
    await http
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ openingCash: '1000.00' })
      .expect(409);

    // Clean up so later tests in this suite start from a known "no open shift" state.
    const mine = await http
      .get('/api/v1/shifts/mine/current')
      .set('Authorization', `Bearer ${staffAToken}`)
      .expect(200);
    await http
      .post(`/api/v1/shifts/${(mine.body as ShiftDto).id}/close`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ closingCashActual: '1000.00' })
      .expect(201);
  });

  it('rejects adding a transaction to a closed shift', async () => {
    const shift = await openShift(staffBToken, '500.00');
    await http
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set('Authorization', `Bearer ${staffBToken}`)
      .send({ closingCashActual: '500.00' })
      .expect(201);

    await http
      .post(`/api/v1/shifts/${shift.id}/transactions`)
      .set('Authorization', `Bearer ${staffBToken}`)
      .send({ type: 'CASH_IN', amount: '100.00' })
      .expect(409);
  });

  it('rejects closing an already-closed shift', async () => {
    const shift = await openShift(staffAToken, '500.00');
    await http
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ closingCashActual: '500.00' })
      .expect(201);

    await http
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ closingCashActual: '500.00' })
      .expect(409);
  });

  it("blocks one Front Desk staff member from seeing another's shift (404, not 403)", async () => {
    const shift = await openShift(staffAToken, '200.00');

    await http
      .get(`/api/v1/shifts/${shift.id}`)
      .set('Authorization', `Bearer ${staffBToken}`)
      .expect(404);

    const staffBList = await http
      .get('/api/v1/shifts')
      .set('Authorization', `Bearer ${staffBToken}`)
      .expect(200);
    expect(
      (staffBList.body as PaginatedResponse<ShiftDto>).data.map((s) => s.id),
    ).not.toContain(shift.id);

    // Clean up.
    await http
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ closingCashActual: '200.00' })
      .expect(201);
  });

  it('blocks Front Desk from the consolidated cash-reports view, but allows Accountant', async () => {
    await http
      .get('/api/v1/shifts/cash-reports')
      .set('Authorization', `Bearer ${staffAToken}`)
      .expect(403);

    const res = await http
      .get('/api/v1/shifts/cash-reports')
      .set('Authorization', `Bearer ${accountantToken}`)
      .expect(200);
    const cashReports = res.body as PaginatedResponse<ShiftDto>;
    expect(Array.isArray(cashReports.data)).toBe(true);
    // Every report returned must belong to an already-closed shift.
    for (const shift of cashReports.data) {
      expect(shift.status).toBe('CLOSED');
      expect(shift.cashReport).not.toBeNull();
    }
  });

  it("attributes a check-in deposit to the collecting staff member's open shift automatically", async () => {
    const shift = await openShift(staffAToken, '0.00');

    const roomRes = await http
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ roomTypeId, roomNumber: `SHIFT-${randomUUID().slice(0, 6)}` })
      .expect(201);
    const roomId = (roomRes.body as { id: string }).id;

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const bookingRes = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        roomId,
        ratePlanId,
        checkInDate: today,
        checkOutDate: tomorrow,
        guest: {
          firstName: 'Shift',
          lastName: 'Guest',
          email: `${randomUUID()}@test.local`,
        },
      })
      .expect(201);
    const booking = bookingRes.body as BookingDto;
    await http
      .post(`/api/v1/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(201);

    await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ depositAmount: '750.00' })
      .expect(201);

    const shiftAfter = await http
      .get(`/api/v1/shifts/${shift.id}`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .expect(200);
    const transactions = (shiftAfter.body as ShiftDto).transactions;
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe('CASH_IN');
    expect(Number(transactions[0].amount)).toBe(750);
    expect(transactions[0].bookingId).toBe(booking.id);

    const closed = await http
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ closingCashActual: '750.00' })
      .expect(201);
    expect(Number((closed.body as ShiftDto).cashReport?.discrepancy)).toBe(0);
  });

  it('does not block check-in when the collecting staff member has no open shift', async () => {
    const roomRes = await http
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ roomTypeId, roomNumber: `NOSHIFT-${randomUUID().slice(0, 6)}` })
      .expect(201);
    const roomId = (roomRes.body as { id: string }).id;

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const bookingRes = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        roomId,
        ratePlanId,
        checkInDate: today,
        checkOutDate: tomorrow,
        guest: {
          firstName: 'NoShift',
          lastName: 'Guest',
          email: `${randomUUID()}@test.local`,
        },
      })
      .expect(201);
    const booking = bookingRes.body as BookingDto;
    await http
      .post(`/api/v1/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(201);

    // staffB should have no open shift at this point in the suite.
    const checkedIn = await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${staffBToken}`)
      .send({ depositAmount: '100.00' })
      .expect(201);
    expect((checkedIn.body as BookingDto).status).toBe('CHECKED_IN');
  });
});
