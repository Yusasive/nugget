import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type {
  AuthTokens,
  BranchDto,
  LoginResponse,
  PaginatedResponse,
  RoleDto,
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

describe('RBAC & branch scoping (e2e)', () => {
  let app: INestApplication<App>;
  let superAdminToken: string;
  let branchAId: string;
  let branchBId: string;
  let managerAToken: string;
  let managerBToken: string;
  let managerAId: string;
  let managerBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
      .compile();

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

    const http = request(app.getHttpServer());
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
    const branchManagerRole = (rolesRes.body as RoleDto[]).find(
      (r) => r.name === 'BRANCH_MANAGER',
    );
    if (!branchManagerRole)
      throw new Error('BRANCH_MANAGER role missing from seed data');

    const branchARes = await http
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: `Branch A ${suffix}` })
      .expect(201);
    branchAId = (branchARes.body as BranchDto).id;

    const branchBRes = await http
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: `Branch B ${suffix}` })
      .expect(201);
    branchBId = (branchBRes.body as BranchDto).id;

    const managerARes = await http
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        branchId: branchAId,
        roleId: branchManagerRole.id,
        email: `manager-a-${suffix}@test.local`,
        password: STAFF_PASSWORD,
        firstName: 'Manager',
        lastName: 'A',
      })
      .expect(201);
    managerAId = (managerARes.body as StaffDto).id;

    const managerBRes = await http
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        branchId: branchBId,
        roleId: branchManagerRole.id,
        email: `manager-b-${suffix}@test.local`,
        password: STAFF_PASSWORD,
        firstName: 'Manager',
        lastName: 'B',
      })
      .expect(201);
    managerBId = (managerBRes.body as StaffDto).id;

    const managerALogin = await http
      .post('/api/v1/auth/login')
      .send({
        email: `manager-a-${suffix}@test.local`,
        password: STAFF_PASSWORD,
      })
      .expect(200);
    managerAToken = (managerALogin.body as LoginResponse).accessToken;

    const managerBLogin = await http
      .post('/api/v1/auth/login')
      .send({
        email: `manager-b-${suffix}@test.local`,
        password: STAFF_PASSWORD,
      })
      .expect(200);
    managerBToken = (managerBLogin.body as LoginResponse).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('rejects a login with the wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_SUPER_ADMIN_EMAIL, password: 'definitely-wrong' })
        .expect(401);
    });

    it('rejects a request with no Authorization header', () => {
      return request(app.getHttpServer()).get('/api/v1/staff').expect(401);
    });
  });

  describe('branch scoping on Staff', () => {
    it("a Branch Manager's staff list only contains their own branch", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      const ids = (res.body as PaginatedResponse<StaffDto>).data.map(
        (s) => s.id,
      );
      expect(ids).toContain(managerAId);
      expect(ids).not.toContain(managerBId);
    });

    it("rejects a Branch Manager reading another branch's staff member (404, not 403 — never confirms it exists)", () => {
      return request(app.getHttpServer())
        .get(`/api/v1/staff/${managerBId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(404);
    });

    it('is symmetric: the other branch is equally blocked in reverse', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/staff/${managerAId}`)
        .set('Authorization', `Bearer ${managerBToken}`)
        .expect(404);
    });

    it('lets Super Admin see staff across both branches', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/staff')
        // pageSize=100 (the max): Super Admin sees every branch's staff, and
        // this dev database accumulates staff across the whole session.
        .query({ pageSize: 100 })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const ids = (res.body as PaginatedResponse<StaffDto>).data.map(
        (s) => s.id,
      );
      expect(ids).toContain(managerAId);
      expect(ids).toContain(managerBId);
    });
  });

  describe('role-gated routes', () => {
    it('rejects a Branch Manager from listing branches (Super Admin only)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(403);
    });

    it('rejects a Branch Manager from creating staff (Super Admin only)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          branchId: branchAId,
          roleId: managerAId, // irrelevant — should be rejected before validation matters
          email: `should-not-be-created-${randomUUID()}@test.local`,
          password: STAFF_PASSWORD,
          firstName: 'Nope',
          lastName: 'Nope',
        })
        .expect(403);
    });
  });

  describe('refresh token rotation', () => {
    it('rotates on refresh and rejects reuse of the old token', async () => {
      const http = request(app.getHttpServer());

      const loginRes = await http
        .post('/api/v1/auth/login')
        .send({
          email: SEED_SUPER_ADMIN_EMAIL,
          password: SEED_SUPER_ADMIN_PASSWORD,
        })
        .expect(200);
      const { refreshToken } = loginRes.body as LoginResponse;

      const refreshRes = await http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);
      const newTokens = refreshRes.body as AuthTokens;
      expect(newTokens.refreshToken).not.toBe(refreshToken);

      // Reusing the rotated-out token must fail — proves revocation, not just issuance of a new one.
      await http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('rejects using a refresh token after logout', async () => {
      const http = request(app.getHttpServer());

      const loginRes = await http
        .post('/api/v1/auth/login')
        .send({
          email: SEED_SUPER_ADMIN_EMAIL,
          password: SEED_SUPER_ADMIN_PASSWORD,
        })
        .expect(200);
      const { refreshToken } = loginRes.body as LoginResponse;

      await http.post('/api/v1/auth/logout').send({ refreshToken }).expect(204);
      await http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared helper — used by M6 and all subsequent describe blocks below.
  // Declared at the outer describe scope so every nested block can call it.
  // ---------------------------------------------------------------------------
  async function createStaffAndLogin(
    roleName: string,
    branchId: string,
    label: string,
    app: INestApplication<App>,
    superAdminToken: string,
  ): Promise<string> {
    const http = request(app.getHttpServer());
    const rolesRes = await http
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    const role = (rolesRes.body as RoleDto[]).find((r) => r.name === roleName);
    if (!role) throw new Error(`${roleName} role missing from seed data`);

    const email = `${label}-${randomUUID().slice(0, 8)}@test.local`;
    await http
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        branchId,
        roleId: role.id,
        email,
        password: STAFF_PASSWORD,
        firstName: label,
        lastName: 'Test',
      })
      .expect(201);
    const login = await http
      .post('/api/v1/auth/login')
      .send({ email, password: STAFF_PASSWORD })
      .expect(200);
    return (login.body as LoginResponse).accessToken;
  }

  describe('Milestone 6 — Tours & Packages RBAC and branch scoping', () => {
    let coordinatorAToken: string;
    let coordinatorBToken: string;
    let frontDeskToken: string;
    let housekeepingToken: string;
    let restaurantStaffToken: string;
    let guideAId: string;

    async function createStaffAndLogin(
      roleName: string,
      branchId: string,
      label: string,
    ): Promise<string> {
      const http = request(app.getHttpServer());
      const rolesRes = await http
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const role = (rolesRes.body as RoleDto[]).find((r) => r.name === roleName);
      if (!role) throw new Error(`${roleName} role missing from seed data`);

      const email = `${label}-${randomUUID().slice(0, 8)}@test.local`;
      await http
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          branchId,
          roleId: role.id,
          email,
          password: STAFF_PASSWORD,
          firstName: label,
          lastName: 'Test',
        })
        .expect(201);
      const login = await http
        .post('/api/v1/auth/login')
        .send({ email, password: STAFF_PASSWORD })
        .expect(200);
      return (login.body as LoginResponse).accessToken;
    }

    beforeAll(async () => {
      coordinatorAToken = await createStaffAndLogin(
        'TOURS_COORDINATOR',
        branchAId,
        'coordinator-a',
      );
      coordinatorBToken = await createStaffAndLogin(
        'TOURS_COORDINATOR',
        branchBId,
        'coordinator-b',
      );
      frontDeskToken = await createStaffAndLogin('FRONT_DESK', branchAId, 'front-desk');
      housekeepingToken = await createStaffAndLogin(
        'HOUSEKEEPING',
        branchAId,
        'housekeeping',
      );
      restaurantStaffToken = await createStaffAndLogin(
        'RESTAURANT_STAFF',
        branchAId,
        'restaurant-staff',
      );

      const guideRes = await request(app.getHttpServer())
        .post('/api/v1/tour-guides')
        .set('Authorization', `Bearer ${coordinatorAToken}`)
        .send({ branchId: branchAId, fullName: 'Branch A Guide' })
        .expect(201);
      guideAId = (guideRes.body as { id: string }).id;
    });

    describe('roles with no access to the Tours & Packages module', () => {
      const deniedTokens = () => [
        ['FRONT_DESK', () => frontDeskToken],
        ['HOUSEKEEPING', () => housekeepingToken],
        ['RESTAURANT_STAFF', () => restaurantStaffToken],
      ] as const;

      it.each(deniedTokens())('%s gets 403 listing tour guides', async (_role, getToken) => {
        await request(app.getHttpServer())
          .get('/api/v1/tour-guides')
          .set('Authorization', `Bearer ${getToken()}`)
          .expect(403);
      });

      it.each(deniedTokens())('%s gets 403 listing vehicles', async (_role, getToken) => {
        await request(app.getHttpServer())
          .get('/api/v1/vehicles')
          .set('Authorization', `Bearer ${getToken()}`)
          .expect(403);
      });

      it.each(deniedTokens())('%s gets 403 listing tour packages', async (_role, getToken) => {
        await request(app.getHttpServer())
          .get('/api/v1/tour-packages')
          .set('Authorization', `Bearer ${getToken()}`)
          .expect(403);
      });

      it.each(deniedTokens())('%s gets 403 listing tour departures', async (_role, getToken) => {
        await request(app.getHttpServer())
          .get('/api/v1/tour-departures')
          .set('Authorization', `Bearer ${getToken()}`)
          .expect(403);
      });

      it.each(deniedTokens())('%s gets 403 listing tour bookings', async (_role, getToken) => {
        await request(app.getHttpServer())
          .get('/api/v1/tour-bookings')
          .set('Authorization', `Bearer ${getToken()}`)
          .expect(403);
      });

      it.each(deniedTokens())('%s gets 403 creating a tour guide', async (_role, getToken) => {
        await request(app.getHttpServer())
          .post('/api/v1/tour-guides')
          .set('Authorization', `Bearer ${getToken()}`)
          .send({ branchId: branchAId, fullName: 'Should Not Be Created' })
          .expect(403);
      });
    });

    describe('branch scoping on Tours & Packages models', () => {
      it("a Tours Coordinator's guide list only contains their own branch", async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/tour-guides')
          .set('Authorization', `Bearer ${coordinatorAToken}`)
          .query({ pageSize: 100 })
          .expect(200);
        const ids = (res.body as PaginatedResponse<{ id: string }>).data.map(
          (g) => g.id,
        );
        expect(ids).toContain(guideAId);
      });

      it("rejects a Tours Coordinator reading another branch's guide (404, not 403)", () => {
        return request(app.getHttpServer())
          .get(`/api/v1/tour-guides/${guideAId}`)
          .set('Authorization', `Bearer ${coordinatorBToken}`)
          .expect(404);
      });

      it("a cross-branch Tours Coordinator's guide list never includes the other branch's guide", async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/tour-guides')
          .set('Authorization', `Bearer ${coordinatorBToken}`)
          .query({ pageSize: 100 })
          .expect(200);
        const ids = (res.body as PaginatedResponse<{ id: string }>).data.map(
          (g) => g.id,
        );
        expect(ids).not.toContain(guideAId);
      });

      it('lets Super Admin see tour guides across both branches', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/tour-guides')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .query({ pageSize: 100 })
          .expect(200);
        const ids = (res.body as PaginatedResponse<{ id: string }>).data.map(
          (g) => g.id,
        );
        expect(ids).toContain(guideAId);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Milestone 7 — Restaurant POS RBAC
  // Denied roles: FRONT_DESK, HOUSEKEEPING, TOURS_COORDINATOR
  // ---------------------------------------------------------------------------
  describe('Milestone 7 — Restaurant POS RBAC', () => {
    let frontDeskToken: string;
    let housekeepingToken: string;
    let coordinatorToken: string;

    beforeAll(async () => {
      frontDeskToken = await createStaffAndLogin('FRONT_DESK', branchAId, 'fd-m7', app, superAdminToken);
      housekeepingToken = await createStaffAndLogin('HOUSEKEEPING', branchAId, 'hk-m7', app, superAdminToken);
      coordinatorToken = await createStaffAndLogin('TOURS_COORDINATOR', branchAId, 'tc-m7', app, superAdminToken);
    });

    const deniedTokens = () => [
      ['FRONT_DESK', () => frontDeskToken],
      ['HOUSEKEEPING', () => housekeepingToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
    ] as const;

    it.each(deniedTokens())('%s gets 403 listing menu categories', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/menu-categories')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 listing menu items', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/menu-items')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 listing restaurant tables', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurant-tables')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 listing restaurant orders', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurant-orders')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 creating a restaurant order', async (_role, getToken) => {
      await request(app.getHttpServer())
        .post('/api/v1/restaurant-orders')
        .set('Authorization', `Bearer ${getToken()}`)
        .send({ orderType: 'DINE_IN', items: [] })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Milestone 8 — Inventory, Suppliers & Purchase Records RBAC
  // Denied roles: FRONT_DESK, HOUSEKEEPING, TOURS_COORDINATOR
  // ---------------------------------------------------------------------------
  describe('Milestone 8 — Inventory, Suppliers & Purchase Records RBAC', () => {
    let frontDeskToken: string;
    let housekeepingToken: string;
    let coordinatorToken: string;

    beforeAll(async () => {
      frontDeskToken = await createStaffAndLogin('FRONT_DESK', branchAId, 'fd-m8', app, superAdminToken);
      housekeepingToken = await createStaffAndLogin('HOUSEKEEPING', branchAId, 'hk-m8', app, superAdminToken);
      coordinatorToken = await createStaffAndLogin('TOURS_COORDINATOR', branchAId, 'tc-m8', app, superAdminToken);
    });

    const deniedTokens = () => [
      ['FRONT_DESK', () => frontDeskToken],
      ['HOUSEKEEPING', () => housekeepingToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
    ] as const;

    it.each(deniedTokens())('%s gets 403 listing inventory items', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 listing suppliers', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/suppliers')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 listing purchase records', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/purchase-records')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 creating a purchase record', async (_role, getToken) => {
      await request(app.getHttpServer())
        .post('/api/v1/purchase-records')
        .set('Authorization', `Bearer ${getToken()}`)
        .send({ supplierId: randomUUID(), items: [] })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Milestone 9 — Expense Management RBAC
  // Denied for list/create: HOUSEKEEPING, TOURS_COORDINATOR
  // Denied for approve/reject: FRONT_DESK, HOUSEKEEPING, TOURS_COORDINATOR, RESTAURANT_STAFF
  // ---------------------------------------------------------------------------
  describe('Milestone 9 — Expense Management RBAC', () => {
    let frontDeskToken: string;
    let housekeepingToken: string;
    let coordinatorToken: string;
    let restaurantStaffToken: string;

    beforeAll(async () => {
      frontDeskToken = await createStaffAndLogin('FRONT_DESK', branchAId, 'fd-m9', app, superAdminToken);
      housekeepingToken = await createStaffAndLogin('HOUSEKEEPING', branchAId, 'hk-m9', app, superAdminToken);
      coordinatorToken = await createStaffAndLogin('TOURS_COORDINATOR', branchAId, 'tc-m9', app, superAdminToken);
      restaurantStaffToken = await createStaffAndLogin('RESTAURANT_STAFF', branchAId, 'rs-m9', app, superAdminToken);
    });

    const listDeniedTokens = () => [
      ['HOUSEKEEPING', () => housekeepingToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
    ] as const;

    const approveDeniedTokens = () => [
      ['FRONT_DESK', () => frontDeskToken],
      ['HOUSEKEEPING', () => housekeepingToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
      ['RESTAURANT_STAFF', () => restaurantStaffToken],
    ] as const;

    it.each(listDeniedTokens())('%s gets 403 listing expenses', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/expenses')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(approveDeniedTokens())('%s gets 403 approving an expense', async (_role, getToken) => {
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${randomUUID()}/approve`)
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(approveDeniedTokens())('%s gets 403 rejecting an expense', async (_role, getToken) => {
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${randomUUID()}/reject`)
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Milestone 12 — Reports & P&L RBAC
  // MANAGEMENT_ROLES only (SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTANT)
  // Denied: FRONT_DESK, HOUSEKEEPING, RESTAURANT_STAFF, TOURS_COORDINATOR
  // Exception: restaurant-sales and inventory reports also allow RESTAURANT_STAFF
  // ---------------------------------------------------------------------------
  describe('Milestone 12 — Reports & P&L RBAC', () => {
    let frontDeskToken: string;
    let housekeepingToken: string;
    let coordinatorToken: string;
    let restaurantStaffToken: string;

    beforeAll(async () => {
      frontDeskToken = await createStaffAndLogin('FRONT_DESK', branchAId, 'fd-m12', app, superAdminToken);
      housekeepingToken = await createStaffAndLogin('HOUSEKEEPING', branchAId, 'hk-m12', app, superAdminToken);
      coordinatorToken = await createStaffAndLogin('TOURS_COORDINATOR', branchAId, 'tc-m12', app, superAdminToken);
      restaurantStaffToken = await createStaffAndLogin('RESTAURANT_STAFF', branchAId, 'rs-m12', app, superAdminToken);
    });

    // All four roles are denied occupancy, expenses, and P&L
    const managementOnlyDenied = () => [
      ['FRONT_DESK', () => frontDeskToken],
      ['HOUSEKEEPING', () => housekeepingToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
      ['RESTAURANT_STAFF', () => restaurantStaffToken],
    ] as const;

    // Only FRONT_DESK, HOUSEKEEPING, TOURS_COORDINATOR denied for restaurant-sales/inventory
    const restaurantReportDenied = () => [
      ['FRONT_DESK', () => frontDeskToken],
      ['HOUSEKEEPING', () => housekeepingToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
    ] as const;

    it.each(managementOnlyDenied())('%s gets 403 on occupancy report', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/occupancy')
        .query({ startDate: '2025-01-01', endDate: '2025-01-31' })
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(managementOnlyDenied())('%s gets 403 on expense report', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/expenses')
        .query({ startDate: '2025-01-01', endDate: '2025-01-31' })
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(managementOnlyDenied())('%s gets 403 on profit-and-loss report', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/profit-and-loss')
        .query({ month: '2025-01' })
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(restaurantReportDenied())('%s gets 403 on restaurant-sales report', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/restaurant-sales')
        .query({ startDate: '2025-01-01', endDate: '2025-01-31' })
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(restaurantReportDenied())('%s gets 403 on inventory report', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/inventory')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Milestone 10 — Housekeeping Tasks RBAC
  // Denied: RESTAURANT_STAFF, TOURS_COORDINATOR
  // ---------------------------------------------------------------------------
  describe('Milestone 10 — Housekeeping Tasks RBAC', () => {
    let restaurantStaffToken: string;
    let coordinatorToken: string;

    beforeAll(async () => {
      restaurantStaffToken = await createStaffAndLogin('RESTAURANT_STAFF', branchAId, 'rs-m10', app, superAdminToken);
      coordinatorToken = await createStaffAndLogin('TOURS_COORDINATOR', branchAId, 'tc-m10', app, superAdminToken);
    });

    const deniedTokens = () => [
      ['RESTAURANT_STAFF', () => restaurantStaffToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
    ] as const;

    it.each(deniedTokens())('%s gets 403 listing housekeeping tasks', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/housekeeping-tasks')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });

    it.each(deniedTokens())('%s gets 403 creating a housekeeping task', async (_role, getToken) => {
      await request(app.getHttpServer())
        .post('/api/v1/housekeeping-tasks')
        .set('Authorization', `Bearer ${getToken()}`)
        .send({ roomId: randomUUID(), description: 'Clean room' })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Milestone 11 — Attendance branch scoping
  // GET /attendance is BRANCH_MANAGER+ only; branch scoping means manager A
  // cannot see manager B's branch attendance records.
  // ---------------------------------------------------------------------------
  describe('Milestone 11 — Attendance branch scoping', () => {
    it("manager A's attendance list does not include manager B's branch records", async () => {
      // Clock manager B in so their branch has at least one record
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${managerBToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/attendance')
        .set('Authorization', `Bearer ${managerAToken}`)
        .query({ pageSize: 100 })
        .expect(200);

      const staffIds = (res.body as PaginatedResponse<{ staffId: string }>).data.map(
        (a) => a.staffId,
      );
      expect(staffIds).not.toContain(managerBId);
    });

    it('non-manager roles get 403 on the attendance list', async () => {
      const frontDeskToken = await createStaffAndLogin('FRONT_DESK', branchAId, 'fd-m11', app, superAdminToken);
      await request(app.getHttpServer())
        .get('/api/v1/attendance')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Milestone 11 — Audit Log RBAC
  // Denied: FRONT_DESK, HOUSEKEEPING, RESTAURANT_STAFF, TOURS_COORDINATOR
  // ---------------------------------------------------------------------------
  describe('Milestone 11 — Audit Log RBAC', () => {
    let frontDeskToken: string;
    let housekeepingToken: string;
    let restaurantStaffToken: string;
    let coordinatorToken: string;

    beforeAll(async () => {
      frontDeskToken = await createStaffAndLogin('FRONT_DESK', branchAId, 'fd-al', app, superAdminToken);
      housekeepingToken = await createStaffAndLogin('HOUSEKEEPING', branchAId, 'hk-al', app, superAdminToken);
      restaurantStaffToken = await createStaffAndLogin('RESTAURANT_STAFF', branchAId, 'rs-al', app, superAdminToken);
      coordinatorToken = await createStaffAndLogin('TOURS_COORDINATOR', branchAId, 'tc-al', app, superAdminToken);
    });

    const deniedTokens = () => [
      ['FRONT_DESK', () => frontDeskToken],
      ['HOUSEKEEPING', () => housekeepingToken],
      ['RESTAURANT_STAFF', () => restaurantStaffToken],
      ['TOURS_COORDINATOR', () => coordinatorToken],
    ] as const;

    it.each(deniedTokens())('%s gets 403 listing audit log entries', async (_role, getToken) => {
      await request(app.getHttpServer())
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403);
    });
  });
});
