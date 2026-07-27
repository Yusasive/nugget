import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  BookingDto,
  LoginResponse,
  PaginatedResponse,
  RoomStatusBoardEntry,
  RoomTypeDto,
} from '@nugget/shared-types';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const SEED_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Proves Milestone 3's Definition of Done directly: "a Front Desk user can
 * check a guest in, transfer them to a different room, and later check them
 * out, with the room-status board reflecting every change immediately."
 */
describe('Front desk operations (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let token: string;
  let branchId: string;
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

  async function createConfirmedBooking(
    roomId: string,
    checkInDate: string,
    checkOutDate: string,
  ): Promise<BookingDto> {
    const created = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        ratePlanId,
        checkInDate,
        checkOutDate,
        guest: {
          firstName: 'Front',
          lastName: 'Desk',
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

  async function boardEntryFor(roomId: string): Promise<RoomStatusBoardEntry> {
    const res = await http
      .get('/api/v1/rooms/status-board')
      // Scoped to this test's own branch: the board is now paginated, and
      // this dev database accumulates rooms across every e2e run in the
      // session — an unscoped query could miss this test's room entirely.
      .query({ pageSize: 100, branchId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const entry = (
      res.body as PaginatedResponse<RoomStatusBoardEntry>
    ).data.find((e) => e.room.id === roomId);
    if (!entry) {
      throw new Error(`No board entry for room ${roomId}`);
    }
    return entry;
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
      .send({ name: `Front Desk Test Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as { id: string }).id;

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

  it('runs the full check-in -> transfer -> check-out lifecycle, with the board reflecting every step', async () => {
    const roomA = await createRoom(`LC-A-${randomUUID().slice(0, 6)}`);
    const roomB = await createRoom(`LC-B-${randomUUID().slice(0, 6)}`);

    expect((await boardEntryFor(roomA)).status).toBe('VACANT');
    expect((await boardEntryFor(roomB)).status).toBe('VACANT');

    const booking = await createConfirmedBooking(
      roomA,
      todayIso(0),
      todayIso(2),
    );

    const beforeCheckIn = await boardEntryFor(roomA);
    expect(beforeCheckIn.status).toBe('VACANT');
    expect(beforeCheckIn.arrivalToday?.id).toBe(booking.id);

    const checkedIn = await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect((checkedIn.body as BookingDto).status).toBe('CHECKED_IN');

    const afterCheckIn = await boardEntryFor(roomA);
    expect(afterCheckIn.status).toBe('OCCUPIED');
    expect(afterCheckIn.activeBooking?.id).toBe(booking.id);

    const transferred = await http
      .post(`/api/v1/bookings/${booking.id}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toRoomId: roomB, reason: 'Guest requested a quieter room' })
      .expect(201);
    expect((transferred.body as BookingDto).status).toBe('CHECKED_IN');
    expect((transferred.body as BookingDto).room.id).toBe(roomB);

    const afterTransferFrom = await boardEntryFor(roomA);
    expect(afterTransferFrom.status).toBe('DIRTY');
    expect(afterTransferFrom.activeBooking).toBeNull();

    const afterTransferTo = await boardEntryFor(roomB);
    expect(afterTransferTo.status).toBe('OCCUPIED');
    expect(afterTransferTo.activeBooking?.id).toBe(booking.id);

    const checkedOut = await http
      .post(`/api/v1/bookings/${booking.id}/check-out`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect((checkedOut.body as BookingDto).status).toBe('CHECKED_OUT');

    const afterCheckOut = await boardEntryFor(roomB);
    expect(afterCheckOut.status).toBe('DIRTY');
    expect(afterCheckOut.activeBooking).toBeNull();

    await http
      .patch(`/api/v1/rooms/${roomB}/housekeeping-status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ housekeepingStatus: 'CLEAN' })
      .expect(200);

    const afterCleaning = await boardEntryFor(roomB);
    expect(afterCleaning.status).toBe('VACANT');
  });

  it('rejects transferring a checked-in guest into a room that is already occupied', async () => {
    const roomA = await createRoom(`OCC-A-${randomUUID().slice(0, 6)}`);
    const roomB = await createRoom(`OCC-B-${randomUUID().slice(0, 6)}`);

    const bookingA = await createConfirmedBooking(
      roomA,
      todayIso(0),
      todayIso(1),
    );
    const bookingB = await createConfirmedBooking(
      roomB,
      todayIso(0),
      todayIso(1),
    );

    await http
      .post(`/api/v1/bookings/${bookingA.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    await http
      .post(`/api/v1/bookings/${bookingB.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .post(`/api/v1/bookings/${bookingA.id}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toRoomId: roomB })
      .expect(409);
  });

  it('rejects transferring into a room that has not been cleaned', async () => {
    const roomA = await createRoom(`DIRTY-A-${randomUUID().slice(0, 6)}`);
    const roomB = await createRoom(`DIRTY-B-${randomUUID().slice(0, 6)}`);

    const bookingA = await createConfirmedBooking(
      roomA,
      todayIso(0),
      todayIso(1),
    );
    await http
      .post(`/api/v1/bookings/${bookingA.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .patch(`/api/v1/rooms/${roomB}/housekeeping-status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ housekeepingStatus: 'DIRTY' })
      .expect(200);

    await http
      .post(`/api/v1/bookings/${bookingA.id}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toRoomId: roomB })
      .expect(409);
  });

  it('rejects transferring into a room that is out of order', async () => {
    const roomA = await createRoom(`OOO-A-${randomUUID().slice(0, 6)}`);
    const roomB = await createRoom(`OOO-B-${randomUUID().slice(0, 6)}`);

    const bookingA = await createConfirmedBooking(
      roomA,
      todayIso(0),
      todayIso(1),
    );
    await http
      .post(`/api/v1/bookings/${bookingA.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .patch(`/api/v1/rooms/${roomB}/out-of-order`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isOutOfOrder: true, reason: 'Plumbing repair' })
      .expect(200);

    await http
      .post(`/api/v1/bookings/${bookingA.id}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toRoomId: roomB })
      .expect(409);
  });

  it('rejects cancelling a booking that has already been checked in', async () => {
    const room = await createRoom(`CXL-${randomUUID().slice(0, 6)}`);
    const booking = await createConfirmedBooking(
      room,
      todayIso(0),
      todayIso(1),
    );
    await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(409);
  });

  it('rejects checking in a booking twice', async () => {
    const room = await createRoom(`DBL-${randomUUID().slice(0, 6)}`);
    const booking = await createConfirmedBooking(
      room,
      todayIso(0),
      todayIso(1),
    );
    await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(409);
  });

  it('applies an early check-in fee when the branch has one configured and the guest arrives early', async () => {
    await http
      .patch(`/api/v1/branches/${branchId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ standardCheckInTime: '23:59', earlyCheckInFeeAmount: '25.00' })
      .expect(200);

    const room = await createRoom(`FEE-${randomUUID().slice(0, 6)}`);
    const booking = await createConfirmedBooking(
      room,
      todayIso(0),
      todayIso(1),
    );

    const checkedIn = await http
      .post(`/api/v1/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const dto = checkedIn.body as BookingDto;
    expect(Number(dto.earlyCheckInFee)).toBe(25);
    expect(Number(dto.totalAmount)).toBe(Number(booking.totalAmount) + 25);

    // Restore the default so it doesn't leak into other tests on this branch.
    await http
      .patch(`/api/v1/branches/${branchId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ standardCheckInTime: '14:00', earlyCheckInFeeAmount: null })
      .expect(200);
  });
});
