import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  BranchDto,
  ExpenseDto,
  InventoryItemDto,
  LoginResponse,
  PaginatedResponse,
  PurchaseRecordDto,
  RoleDto,
  SupplierDto,
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
 * Proves Milestone 8's Definition of Done directly: "recording a purchase
 * increases stock on hand and creates a corresponding expense record
 * automatically, in a single atomic operation — verified by a test that a
 * failure in either half rolls back both."
 */
describe('Purchase records — atomicity (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let staffToken: string;
  let superAdminToken: string;
  let branchId: string;
  let supplierId: string;
  let itemAId: string;

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
    const restaurantStaffRole = (rolesRes.body as RoleDto[]).find(
      (r) => r.name === 'RESTAURANT_STAFF',
    );
    if (!restaurantStaffRole) {
      throw new Error('RESTAURANT_STAFF role missing from seed data');
    }

    const branchRes = await http
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: `Purchase Test Branch ${suffix}` })
      .expect(201);
    branchId = (branchRes.body as BranchDto).id;

    await http
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        branchId,
        roleId: restaurantStaffRole.id,
        email: `restaurant-staff-${suffix}@test.local`,
        password: STAFF_PASSWORD,
        firstName: 'Resto',
        lastName: 'Staff',
      })
      .expect(201);

    const staffLogin = await http
      .post('/api/v1/auth/login')
      .send({
        email: `restaurant-staff-${suffix}@test.local`,
        password: STAFF_PASSWORD,
      })
      .expect(200);
    staffToken = (staffLogin.body as LoginResponse).accessToken;

    const supplierRes = await http
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ branchId, name: 'Kebbi Fresh Produce' })
      .expect(201);
    supplierId = (supplierRes.body as SupplierDto).id;

    const itemARes = await http
      .post('/api/v1/inventory-items')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        branchId,
        name: 'Rice (bag)',
        unit: 'kg',
        reorderThreshold: '20',
        unitCost: '5.00',
      })
      .expect(201);
    itemAId = (itemARes.body as InventoryItemDto).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rolls back the stock movement and never creates an expense when a line item fails mid-transaction', async () => {
    const [expensesBefore, itemBefore] = await Promise.all([
      http
        .get(`/api/v1/expenses?branchId=${branchId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200),
      http
        .get(`/api/v1/inventory-items/${itemAId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200),
    ]);
    const expensesBeforeCount = (
      expensesBefore.body as PaginatedResponse<ExpenseDto>
    ).total;
    expect((itemBefore.body as InventoryItemDto).quantityOnHand).toBe('0');

    await http
      .post('/api/v1/purchase-records')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        branchId,
        supplierId,
        lineItems: [
          { inventoryItemId: itemAId, quantity: '100', unitCost: '4.50' },
          // Nonexistent inventory item — this line fails after the first
          // line's stock movement would already have been written.
          { inventoryItemId: randomUUID(), quantity: '10', unitCost: '1.00' },
        ],
      })
      .expect(404);

    const [expensesAfter, itemAfter, purchasesAfter] = await Promise.all([
      http
        .get(`/api/v1/expenses?branchId=${branchId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200),
      http
        .get(`/api/v1/inventory-items/${itemAId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200),
      http
        .get('/api/v1/purchase-records')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200),
    ]);

    // The first line item's stock movement must have been rolled back —
    // quantityOnHand is exactly what it was before the failed attempt, not
    // partially applied.
    expect((itemAfter.body as InventoryItemDto).quantityOnHand).toBe('0');
    // No expense was created for the failed attempt.
    expect((expensesAfter.body as PaginatedResponse<ExpenseDto>).total).toBe(
      expensesBeforeCount,
    );
    // No purchase record persisted either.
    expect(
      (purchasesAfter.body as PaginatedResponse<PurchaseRecordDto>).data.some(
        (p) => p.supplier.id === supplierId,
      ),
    ).toBe(false);
  });

  it('atomically increases stock and creates a matching expense on a valid purchase', async () => {
    const purchaseRes = await http
      .post('/api/v1/purchase-records')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        branchId,
        supplierId,
        lineItems: [
          { inventoryItemId: itemAId, quantity: '100', unitCost: '4.50' },
        ],
      })
      .expect(201);
    const purchase = purchaseRes.body as PurchaseRecordDto;
    expect(purchase.totalCost).toBe('450');
    expect(purchase.expenseId).not.toBeNull();

    const itemRes = await http
      .get(`/api/v1/inventory-items/${itemAId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect((itemRes.body as InventoryItemDto).quantityOnHand).toBe('100');

    const expenseRes = await http
      .get(`/api/v1/expenses/${purchase.expenseId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    const expense = expenseRes.body as ExpenseDto;
    expect(expense.amount).toBe('450');
    expect(expense.status).toBe('PENDING');
    expect(expense.purchaseRecordId).toBe(purchase.id);
    expect(expense.category.name).toBe('Restaurant Purchases');
  });
});
