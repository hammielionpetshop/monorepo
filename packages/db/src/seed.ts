import * as dotenv from 'dotenv';
import path from 'path';
import { createDb } from './index.js';
import * as schema from './schema/index.js';
import { eq, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const db = createDb(connectionString);

async function main() {
  console.log('🌱 Seeding database...');

  // 0. Truncate all tables
  console.log('   - Truncating tables...');
  await db.execute(sql`TRUNCATE TABLE 
    petshop.users, 
    petshop.roles, 
    petshop.units_of_measure, 
    petshop.payment_methods, 
    petshop.expense_categories, 
    petshop.branches 
    RESTART IDENTITY CASCADE`);

  // 1. Roles
  console.log('   - Seeding roles...');
  const roleData = [
    { name: 'OWNER', description: 'Full access to everything' },
    { name: 'GM', description: 'General Manager - high level management' },
    { name: 'MANAGER', description: 'Store Manager' },
    { name: 'KASIR', description: 'Standard cashier access' },
    { name: 'GUDANG', description: 'Warehouse and stock management' },
    { name: 'FINANCE', description: 'Financial and debt management' },
  ];
  
  const createdRoles = await db.insert(schema.roles).values(roleData).returning();
  const roleMap = Object.fromEntries(createdRoles.map(r => [r.name, r.id]));

  // 2. Units of Measure
  console.log('   - Seeding UOMs...');
  const uomData = [
    { code: 'PCS', name: 'Pieces', isBase: true },
    { code: 'SAK', name: 'Sak', isBase: false },
    { code: 'BOX', name: 'Box', isBase: false },
    { code: 'DUS', name: 'Dus', isBase: false },
    { code: 'KG', name: 'Kilogram', isBase: true },
    { code: 'GR', name: 'Gram', isBase: true },
    { code: 'LTR', name: 'Liter', isBase: true },
    { code: 'PACK', name: 'Pack', isBase: false },
  ];
  await db.insert(schema.unitsOfMeasure).values(uomData);

  // 3. Payment Methods
  console.log('   - Seeding payment methods...');
  const paymentMethods = [
    { name: 'CASH', type: 'CASH' },
    { name: 'TRANSFER_BCA', type: 'BANK_TRANSFER' },
    { name: 'QRIS', type: 'QRIS' },
    { name: 'DEBT', type: 'DEBT' },
  ];
  await db.insert(schema.paymentMethods).values(paymentMethods);

  // 4. Expense Categories
  console.log('   - Seeding expense categories...');
  const expenseCategories = [
    { name: 'Air Galon / Minuman Staff' },
    { name: 'Alat Kebersihan' },
    { name: 'Alat Tulis Kantor (ATK)' },
    { name: 'Sayur & Makanan Hewan' },
    { name: 'Listrik & Air' },
    { name: 'Kesehatan Hamster / Obat' },
    { name: 'Gaji & Bonus Staff' },
    { name: 'Lain-lain' },
  ];
  await db.insert(schema.expenseCategories).values(expenseCategories);

  // 5. Initial Branch
  console.log('   - Seeding main branch...');
  const [mainBranch] = await db.insert(schema.branches).values({
    code: 'HQ',
    name: 'Hammielion Headquarter',
    address: 'Main St 123',
  }).returning();

  // 6. Initial Admin User
  console.log('   - Seeding admin user...');
  const passwordHash = await argon2.hash('admin123');
  const pinHash = await argon2.hash('0000');

  await db.insert(schema.users).values([
    {
      staffNumber: 'ADM001',
      email: 'admin@example.com',
      passwordHash: passwordHash,
      pinHash: pinHash,
      name: 'Owner Hammielion',
      roleId: roleMap['OWNER'],
      branchId: mainBranch.id,
    },
    {
      staffNumber: 'MGR001',
      email: 'manager@example.com',
      passwordHash: passwordHash,
      pinHash: await argon2.hash('1234'),
      name: 'Budi Manager',
      roleId: roleMap['MANAGER'],
      branchId: mainBranch.id,
    },
    {
      staffNumber: 'KSR001',
      email: 'cashier1@example.com',
      passwordHash: passwordHash,
      pinHash: await argon2.hash('1111'),
      name: 'Ani Kasir',
      roleId: roleMap['KASIR'],
      branchId: mainBranch.id,
    },
    {
      staffNumber: 'KSR002',
      email: 'cashier2@example.com',
      passwordHash: passwordHash,
      pinHash: await argon2.hash('2222'),
      name: 'Budi Kasir',
      roleId: roleMap['KASIR'],
      branchId: mainBranch.id,
    }
  ]);

  console.log('✅ Seeding completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:');
  console.error(err);
  process.exit(1);
});
