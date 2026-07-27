import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRoleName } from '@nugget/shared-types';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SEED_BRANCH_NAME = 'Birnin Kebbi';
const SEED_SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@nugget.test';
const SEED_SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
/** Shared password for every non-Super-Admin seeded account — local/dev convenience only. */
const SEED_STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? 'ChangeMe123!';

/** One test login per role so every dashboard view can be exercised locally. */
const SEED_STAFF_ACCOUNTS: Record<
  StaffRoleName,
  { email: string; password: string; firstName: string; lastName: string }
> = {
  SUPER_ADMIN: {
    email: SEED_SUPER_ADMIN_EMAIL,
    password: SEED_SUPER_ADMIN_PASSWORD,
    firstName: 'Super',
    lastName: 'Admin',
  },
  BRANCH_MANAGER: {
    email: 'manager@nugget.test',
    password: SEED_STAFF_PASSWORD,
    firstName: 'Blessing',
    lastName: 'Adeyemi',
  },
  FRONT_DESK: {
    email: 'frontdesk@nugget.test',
    password: SEED_STAFF_PASSWORD,
    firstName: 'Amina',
    lastName: 'Yusuf',
  },
  HOUSEKEEPING: {
    email: 'housekeeping@nugget.test',
    password: SEED_STAFF_PASSWORD,
    firstName: 'Musa',
    lastName: 'Ibrahim',
  },
  ACCOUNTANT: {
    email: 'accountant@nugget.test',
    password: SEED_STAFF_PASSWORD,
    firstName: 'Ngozi',
    lastName: 'Okafor',
  },
  TOURS_COORDINATOR: {
    email: 'tours@nugget.test',
    password: SEED_STAFF_PASSWORD,
    firstName: 'Ibrahim',
    lastName: 'Sani',
  },
  RESTAURANT_STAFF: {
    email: 'restaurant@nugget.test',
    password: SEED_STAFF_PASSWORD,
    firstName: 'Chiamaka',
    lastName: 'Eze',
  },
};

async function main() {
  for (const roleName of STAFF_ROLES) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: { label: STAFF_ROLE_LABELS[roleName] },
      create: { name: roleName, label: STAFF_ROLE_LABELS[roleName] },
    });
  }
  console.log(`Seeded ${STAFF_ROLES.length} roles.`);

  let branch = await prisma.branch.findFirst({ where: { name: SEED_BRANCH_NAME } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { name: SEED_BRANCH_NAME, address: 'Birnin Kebbi, Kebbi State, Nigeria' },
    });
    console.log(`Created branch "${branch.name}".`);
  }

  // --- Demo inventory (idempotent) -------------------------------------------
  // Room types
  let standardType = await prisma.roomType.findFirst({
    where: { branchId: branch.id, name: 'Standard' },
  });
  if (!standardType) {
    standardType = await prisma.roomType.create({
      data: {
        branchId: branch.id,
        name: 'Standard',
        description: 'A comfortable room with all the essentials for a relaxing stay.',
        maxOccupancy: 2,
        amenities: ['Wi-Fi', 'Air Conditioning', 'TV', 'En-suite Bathroom'],
      },
    });
  }

  let deluxeType = await prisma.roomType.findFirst({
    where: { branchId: branch.id, name: 'Deluxe' },
  });
  if (!deluxeType) {
    deluxeType = await prisma.roomType.create({
      data: {
        branchId: branch.id,
        name: 'Deluxe',
        description: 'Spacious and elegantly furnished with premium amenities and a beautiful view.',
        maxOccupancy: 3,
        amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Balcony', 'En-suite Bathroom'],
      },
    });
  }

  let suiteType = await prisma.roomType.findFirst({
    where: { branchId: branch.id, name: 'Suite' },
  });
  if (!suiteType) {
    suiteType = await prisma.roomType.create({
      data: {
        branchId: branch.id,
        name: 'Suite',
        description: 'Our finest accommodation — a full suite with a separate living area, premium furnishings, and personalised service.',
        maxOccupancy: 4,
        amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Jacuzzi', 'Living Room', 'Kitchenette', 'Butler Service'],
      },
    });
  }

  // Rate plans
  const ensureRatePlan = async (roomTypeId: string, name: string, price: string) => {
    const existing = await prisma.ratePlan.findFirst({ where: { roomTypeId, name } });
    if (!existing) {
      await prisma.ratePlan.create({
        data: { branchId: branch!.id, roomTypeId, name, type: 'STANDARD', pricePerNight: price },
      });
    }
  };
  await ensureRatePlan(standardType.id, 'Standard Rate', '25000.00');
  await ensureRatePlan(deluxeType.id, 'Standard Rate', '45000.00');
  await ensureRatePlan(suiteType.id, 'Standard Rate', '85000.00');

  // Rooms
  const ensureRoom = async (roomTypeId: string, roomNumber: string) => {
    const existing = await prisma.room.findFirst({ where: { branchId: branch!.id, roomNumber } });
    if (!existing) {
      await prisma.room.create({ data: { branchId: branch!.id, roomTypeId, roomNumber } });
    }
  };
  await ensureRoom(standardType.id, '101');
  await ensureRoom(standardType.id, '102');
  await ensureRoom(standardType.id, '103');
  await ensureRoom(deluxeType.id, '201');
  await ensureRoom(deluxeType.id, '202');
  await ensureRoom(suiteType.id, '301');

  console.log('Demo room inventory seeded (Standard ×3, Deluxe ×2, Suite ×1).');

  // Tour package
  const existingTour = await prisma.tourPackage.findFirst({
    where: { branchId: branch.id, name: 'Kebbi River Safari' },
  });
  if (!existingTour) {
    await prisma.tourPackage.create({
      data: {
        branchId: branch.id,
        name: 'Kebbi River Safari',
        description: 'A guided boat tour along the scenic Kebbi River — spot wildlife, visit fishing villages, and enjoy a riverside picnic.',
        durationMinutes: 240,
        defaultPricePerSeat: '15000.00',
        defaultCapacity: 12,
      },
    });
    console.log('Demo tour package seeded.');
  }
  // ---------------------------------------------------------------------------

  const created: { role: StaffRoleName; email: string; password: string }[] = [];

  for (const roleName of STAFF_ROLES) {
    const account = SEED_STAFF_ACCOUNTS[roleName];
    const existing = await prisma.staff.findUnique({ where: { email: account.email } });
    if (existing) {
      console.log(`${roleName} "${account.email}" already exists, skipping.`);
      continue;
    }

    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.staff.create({
      data: {
        branchId: branch.id,
        roleId: role.id,
        email: account.email,
        passwordHash: await argon2.hash(account.password),
        firstName: account.firstName,
        lastName: account.lastName,
      },
    });
    created.push({ role: roleName, email: account.email, password: account.password });
  }

  if (created.length === 0) {
    console.log('All seed staff accounts already exist — nothing new created.');
    return;
  }

  console.log('\nSeed staff accounts created:');
  for (const { role, email, password } of created) {
    console.log(`  ${role.padEnd(18)} ${email.padEnd(24)} ${password}`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
