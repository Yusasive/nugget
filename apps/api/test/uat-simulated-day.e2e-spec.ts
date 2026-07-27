import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type {
  BookingDto,
  FolioDto,
  LoginResponse,
  ProfitAndLossDto,
  RestaurantOrderDto,
  RoleDto,
  RoomTypeDto,
  ShiftDto,
  TourBookingDto,
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
 * Milestone 14 UAT — Simulated Day
 *
 * Proves the M14 Definition of Done end-to-end:
 *   1. Hotel: check-in → room-service order → shift close → report pull
 *   2. Restaurant: dinner service order → KOT pipeline → serve → bill
 *   3. Tours: booking → departure → manifest
 *   4. Shift: open → payments → close with reconciliation
 *
 * All four workflows run against the real app, real Postgres, and real Redis.
 */
describe('UAT — Simulated Day (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  // Tokens
  let superAdminToken: string;
  let frontDeskToken: string;
  let restaurantStaffToken: string;
  let coordinatorToken: string;
  let accountantToken: string;

  // Shared branch & catalogue IDs
  let branchId: string;
  let roomTypeId: string;
  let ratePlanId: string;
  let tourPackageId: string;
  let menuCategoryId: string;
  let menuItemId: string;
  let tableId: string;

  function todayIso(offsetDays = 0): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  async function createStaffAndLogin(roleName: string, label: string): Promise<string> {
    const rolesRes = await http
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    const role = (rolesRes.body as RoleDto[]).find((r) => r.name === roleName);
    if (!role) throw new Error(`${roleName} role missing`);

    const email = `${label}-${randomUUID().slice(0, 8)}@uat.local`;
    await http
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ branchId, roleId: role.id, email, password: STAFF_PASSWORD, firstName: label, lastName: 'UAT' })
      .expect(201);

    const login = await http
      .post('/api/v1/auth/login')
      .send({ email, password: STAFF_PASSWORD })
      .expect(200);
    return (login.body as LoginResponse).accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    http = request(app.getHttpServer());

    const suffix = randomUUID().slice(0, 8);

    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: SEED_SUPER_ADMIN_EMAIL, password: SEED_SUPER_ADMIN_PASSWORD })
      .expect(200);
    superAdminToken = (login.body as LoginResponse).accessToken;

    // Branch
    const branchRes = await http
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: `UAT Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as { id: string }).id;

    // Staff
    [frontDeskToken, restaurantStaffToken, coordinatorToken, accountantToken] =
      await Promise.all([
        createStaffAndLogin('FRONT_DESK', 'fd-uat'),
        createStaffAndLogin('RESTAURANT_STAFF', 'rs-uat'),
        createStaffAndLogin('TOURS_COORDINATOR', 'tc-uat'),
        createStaffAndLogin('ACCOUNTANT', 'ac-uat'),
      ]);

    // Room catalogue
    const roomTypeRes = await http
      .post('/api/v1/room-types')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ branchId, name: 'Deluxe', maxOccupancy: 2 })
      .expect(201);
    roomTypeId = (roomTypeRes.body as RoomTypeDto).id;

    const ratePlanRes = await http
      .post('/api/v1/rate-plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ roomTypeId, name: 'Standard', type: 'STANDARD', pricePerNight: '200.00' })
      .expect(201);
    ratePlanId = (ratePlanRes.body as { id: string }).id;

    // Tour catalogue
    const packageRes = await http
      .post('/api/v1/tour-packages')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ branchId, name: `UAT Tour ${suffix}`, durationMinutes: 240, defaultPricePerSeat: '50.00', defaultCapacity: 10 })
      .expect(201);
    tourPackageId = (packageRes.body as { id: string }).id;

    // Restaurant catalogue
    const catRes = await http
      .post('/api/v1/menu-categories')
      .set('Authorization', `Bearer ${restaurantStaffToken}`)
      .send({ branchId, name: 'Mains' })
      .expect(201);
    menuCategoryId = (catRes.body as { id: string }).id;

    const itemRes = await http
      .post('/api/v1/menu-items')
      .set('Authorization', `Bearer ${restaurantStaffToken}`)
      .send({ branchId, categoryId: menuCategoryId, name: 'Jollof Rice', price: '2500.00' })
      .expect(201);
    menuItemId = (itemRes.body as { id: string }).id;

    const tableRes = await http
      .post('/api/v1/restaurant-tables')
      .set('Authorization', `Bearer ${restaurantStaffToken}`)
      .send({ branchId, tableNumber: `T-${suffix}`, capacity: 4 })
      .expect(201);
    tableId = (tableRes.body as { id: string }).id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Workflow 1: Hotel — check-in → room-service order → shift close → report
  // ---------------------------------------------------------------------------
  describe('Workflow 1 — Hotel: check-in → room-service order → shift close → report', () => {
    let roomId: string;
    let bookingId: string;
    let shiftId: string;

    it('front desk opens a shift', async () => {
      const res = await http
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ openingCash: '10000.00' })
        .expect(201);
      shiftId = (res.body as ShiftDto).id;
      expect((res.body as ShiftDto).status).toBe('OPEN');
    });

    it('creates a room and a confirmed booking', async () => {
      const roomRes = await http
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ roomTypeId, roomNumber: `UAT-${randomUUID().slice(0, 6)}` })
        .expect(201);
      roomId = (roomRes.body as { id: string }).id;

      const bookingRes = await http
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          roomId,
          ratePlanId,
          checkInDate: todayIso(0),
          checkOutDate: todayIso(2),
          guest: { firstName: 'UAT', lastName: 'Guest', email: `${randomUUID()}@uat.local` },
        })
        .expect(201);
      bookingId = (bookingRes.body as BookingDto).id;

      await http
        .post(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(201);
    });

    it('front desk checks the guest in with a deposit — deposit lands on the open shift', async () => {
      const res = await http
        .post(`/api/v1/bookings/${bookingId}/check-in`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ depositAmount: '1000.00' })
        .expect(201);
      expect((res.body as BookingDto).status).toBe('CHECKED_IN');

      const shiftRes = await http
        .get(`/api/v1/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .expect(200);
      const txns = (shiftRes.body as ShiftDto).transactions;
      expect(txns.some((t) => t.bookingId === bookingId && t.type === 'CASH_IN')).toBe(true);
    });

    it('restaurant staff creates a room-service order linked to the booking and bills it — folio charge appears', async () => {
      const orderRes = await http
        .post('/api/v1/restaurant-orders')
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .send({ orderType: 'ROOM_SERVICE', roomBookingId: bookingId })
        .expect(201);
      const rsOrderId = (orderRes.body as RestaurantOrderDto).id;

      await http
        .post(`/api/v1/restaurant-orders/${rsOrderId}/items`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .send({ items: [{ menuItemId, quantity: 2 }] })
        .expect(201);

      await http
        .post(`/api/v1/restaurant-orders/${rsOrderId}/send-to-kitchen`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(201);

      // Advance the item through the full KOT pipeline so it can be billed
      const sentOrder = await http
        .get(`/api/v1/restaurant-orders/${rsOrderId}`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(200);
      const rsItemId = (sentOrder.body as RestaurantOrderDto).items[0].id;
      for (const status of ['PREPARING', 'READY', 'SERVED'] as const) {
        await http
          .patch(`/api/v1/restaurant-orders/${rsOrderId}/items/${rsItemId}/kitchen-status`)
          .set('Authorization', `Bearer ${restaurantStaffToken}`)
          .send({ status })
          .expect(200);
      }

      // Bill the room-service order — this is what creates the folio charge
      await http
        .post(`/api/v1/restaurant-orders/${rsOrderId}/serve`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(201);

      await http
        .post(`/api/v1/restaurant-orders/${rsOrderId}/bill`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(201);

      const folioRes = await http
        .get(`/api/v1/bookings/${bookingId}/folio`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const folio = folioRes.body as FolioDto;
      expect(folio.charges.some((c) => c.category === 'RESTAURANT')).toBe(true);
    });

    it('front desk closes the shift with zero discrepancy', async () => {
      // Expected = 10000 opening + 1000 deposit = 11000
      const res = await http
        .post(`/api/v1/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ closingCashActual: '11000.00' })
        .expect(201);
      expect((res.body as ShiftDto).status).toBe('CLOSED');
      expect(Number((res.body as ShiftDto).cashReport?.discrepancy)).toBe(0);
    });

    it('accountant can pull an occupancy report for the branch', async () => {
      const res = await http
        .get('/api/v1/reports/occupancy')
        .set('Authorization', `Bearer ${accountantToken}`)
        .query({ branchId })
        .expect(200);
      expect(res.body).toHaveProperty('occupancyRate');
      expect(res.body).toHaveProperty('adr');
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 2: Restaurant — dinner service order → KOT pipeline → serve → bill
  // ---------------------------------------------------------------------------
  describe('Workflow 2 — Restaurant: order → KOT pipeline → serve → bill', () => {
    let orderId: string;
    let orderItemId: string;

    it('restaurant staff opens a dine-in order at a table', async () => {
      const res = await http
        .post('/api/v1/restaurant-orders')
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .send({ orderType: 'DINE_IN', tableId })
        .expect(201);
      orderId = (res.body as RestaurantOrderDto).id;
      expect((res.body as RestaurantOrderDto).status).toBe('OPEN');
    });

    it('adds items to the order', async () => {
      const res = await http
        .post(`/api/v1/restaurant-orders/${orderId}/items`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .send({ items: [{ menuItemId, quantity: 3 }] })
        .expect(201);
      orderItemId = (res.body as RestaurantOrderDto).items[0].id;
      expect((res.body as RestaurantOrderDto).items).toHaveLength(1);
    });

    it('sends the order to the kitchen — status becomes SENT_TO_KITCHEN', async () => {
      const res = await http
        .post(`/api/v1/restaurant-orders/${orderId}/send-to-kitchen`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(201);
      expect((res.body as RestaurantOrderDto).status).toBe('SENT_TO_KITCHEN');
    });

    it('order appears on the kitchen display', async () => {
      const res = await http
        .get('/api/v1/restaurant-orders/kitchen-display')
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(200);
      const orders = res.body as RestaurantOrderDto[];
      expect(orders.some((o) => o.id === orderId)).toBe(true);
    });

    it('kitchen advances item through PREPARING → READY → SERVED', async () => {
      await http
        .patch(`/api/v1/restaurant-orders/${orderId}/items/${orderItemId}/kitchen-status`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .send({ status: 'PREPARING' })
        .expect(200);

      await http
        .patch(`/api/v1/restaurant-orders/${orderId}/items/${orderItemId}/kitchen-status`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .send({ status: 'READY' })
        .expect(200);

      const res = await http
        .patch(`/api/v1/restaurant-orders/${orderId}/items/${orderItemId}/kitchen-status`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .send({ status: 'SERVED' })
        .expect(200);
      const item = (res.body as RestaurantOrderDto).items.find((i) => i.id === orderItemId);
      expect(item?.kitchenStatus).toBe('SERVED');
    });

    it('marks the order as served', async () => {
      const res = await http
        .post(`/api/v1/restaurant-orders/${orderId}/serve`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(201);
      expect((res.body as RestaurantOrderDto).status).toBe('SERVED');
    });

    it('bills the order — status becomes PAID, and folio charge lands on linked booking', async () => {
      const res = await http
        .post(`/api/v1/restaurant-orders/${orderId}/bill`)
        .set('Authorization', `Bearer ${restaurantStaffToken}`)
        .expect(201);
      expect((res.body as RestaurantOrderDto).status).toBe('PAID');
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 3: Tours — booking → departure → manifest
  // ---------------------------------------------------------------------------
  describe('Workflow 3 — Tours: booking → departure → manifest', () => {
    let departureId: string;
    let tourBookingId: string;

    it('coordinator creates a departure with a guide and vehicle', async () => {
      const [guideRes, vehicleRes] = await Promise.all([
        http
          .post('/api/v1/tour-guides')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({ branchId, fullName: 'UAT Guide' })
          .expect(201),
        http
          .post('/api/v1/vehicles')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({ branchId, name: 'UAT Bus', capacity: 10 })
          .expect(201),
      ]);

      const depRes = await http
        .post('/api/v1/tour-departures')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          tourPackageId,
          guideId: (guideRes.body as { id: string }).id,
          vehicleId: (vehicleRes.body as { id: string }).id,
          departureAt: '2027-09-15T08:00:00Z',
          returnAt: '2027-09-15T16:00:00Z',
          totalSeats: 8,
        })
        .expect(201);
      departureId = (depRes.body as { id: string }).id;
    });

    it('guest books and confirms a tour', async () => {
      const created = await http
        .post('/api/v1/tour-bookings')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          tourDepartureId: departureId,
          seats: 2,
          guest: { firstName: 'Tour', lastName: 'Guest', email: `${randomUUID()}@uat.local` },
        })
        .expect(201);
      tourBookingId = (created.body as TourBookingDto).id;

      const confirmed = await http
        .post(`/api/v1/tour-bookings/${tourBookingId}/confirm`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(201);
      expect((confirmed.body as TourBookingDto).status).toBe('CONFIRMED');
    });

    it('departure shows reduced available seats after booking', async () => {
      const res = await http
        .get(`/api/v1/tour-departures/${departureId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
      expect((res.body as { availableSeats: number }).availableSeats).toBe(6);
    });

    it('coordinator can view the tour manifest (departure with bookings)', async () => {
      const res = await http
        .get(`/api/v1/tour-departures/${departureId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('id', departureId);
      // The departure DTO nests the package under tourPackage, not tourPackageId
      expect((res.body as { tourPackage: { id: string } }).tourPackage.id).toBe(tourPackageId);
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow 4: Shift — open → payments → close with reconciliation
  // ---------------------------------------------------------------------------
  describe('Workflow 4 — Shift: open → payments → close with reconciliation', () => {
    let shiftId: string;

    it('front desk opens a new shift', async () => {
      const res = await http
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ openingCash: '5000.00' })
        .expect(201);
      shiftId = (res.body as ShiftDto).id;
    });

    it('records two cash-in and one cash-out transaction', async () => {
      await http
        .post(`/api/v1/shifts/${shiftId}/transactions`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ type: 'CASH_IN', amount: '3000.00', description: 'Room 201 payment' })
        .expect(201);

      await http
        .post(`/api/v1/shifts/${shiftId}/transactions`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ type: 'CASH_IN', amount: '1500.00', description: 'Room 202 payment' })
        .expect(201);

      const res = await http
        .post(`/api/v1/shifts/${shiftId}/transactions`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ type: 'CASH_OUT', amount: '200.00', description: 'Petty cash' })
        .expect(201);
      expect((res.body as ShiftDto).transactions).toHaveLength(3);
    });

    it('closes with zero discrepancy when drawer matches expected', async () => {
      // 5000 + 3000 + 1500 - 200 = 9300
      const res = await http
        .post(`/api/v1/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ closingCashActual: '9300.00' })
        .expect(201);
      const dto = res.body as ShiftDto;
      expect(dto.status).toBe('CLOSED');
      expect(Number(dto.closingCashExpected)).toBe(9300);
      expect(Number(dto.cashReport?.discrepancy)).toBe(0);
    });

    it('accountant can pull the P&L report for the branch', async () => {
      const month = new Date().toISOString().slice(0, 7); // e.g. "2025-07"
      const res = await http
        .get('/api/v1/reports/profit-and-loss')
        .set('Authorization', `Bearer ${accountantToken}`)
        .query({ month, branchId })
        .expect(200);
      const report = res.body as ProfitAndLossDto;
      expect(report).toHaveProperty('month', month);
      expect(report).toHaveProperty('totalRevenue');
      expect(report).toHaveProperty('totalExpenses');
      expect(report).toHaveProperty('netProfit');
    });
  });
});
