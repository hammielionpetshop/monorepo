import { sql } from 'drizzle-orm';
import { serial, integer, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { products } from './products';
import { stockOpnames, stockOpnameItems } from './stock_opnames';
import { stockAdjustments } from './inventory';

// Fase lanjutan setelah SO Besar (type='FULL') ditutup: item yang sudah APPROVED dengan
// varianceQty != 0 masih perlu ditelusuri lebih jauh ("ternyata ketemu", "hangus jadi
// kerugian toko", "dibebankan ke karyawan", "lebih karena alasan tertentu"). Ini lapisan
// pencatatan terpisah di atas approval yang sudah final — bukan mengubah keputusan approve.
export const soVarianceResolutions = petshop.table('so_variance_resolutions', {
  id: serial('id').primaryKey(),
  soItemId: integer('so_item_id').references(() => stockOpnameItems.id).notNull(),
  soId: integer('so_id').references(() => stockOpnames.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  disposition: varchar('disposition', { length: 20 }).notNull(), // FOUND, WRITTEN_OFF, EMPLOYEE_CHARGE, OVERAGE_EXPLAINED
  varianceQty: integer('variance_qty').notNull(), // snapshot item.varianceQty saat resolusi (bertanda)
  varianceCostValue: integer('variance_cost_value').notNull(), // snapshot |item.varianceCostValue|
  // Denormalisasi sum(so_resolution_employee_charges.amount) supaya laporan tidak perlu join
  // tiap kali menghitung porsi yang tertagih vs porsi yang otomatis jadi kerugian toko.
  employeeChargedTotal: integer('employee_charged_total').default(0).notNull(),
  note: text('note').notNull(),
  stockAdjustmentId: integer('stock_adjustment_id').references(() => stockAdjustments.id), // terisi hanya untuk FOUND
  resolvedById: integer('resolved_by_id').references(() => users.id).notNull(),
  resolvedAt: timestamp('resolved_at').defaultNow().notNull(),
  voidedAt: timestamp('voided_at'),
  voidedBy: integer('voided_by').references(() => users.id),
  voidReason: varchar('void_reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  // Maksimal satu resolusi AKTIF per item — boleh resolusi baru setelah yang lama di-void.
  uniqueIndex('idx_so_variance_resolutions_item_active').on(t.soItemId).where(sql`${t.voidedAt} IS NULL`),
  index('idx_so_variance_resolutions_branch_resolved').on(t.branchId, t.resolvedAt),
  index('idx_so_variance_resolutions_disposition').on(t.disposition),
]);

// Pembagian tagihan ke karyawan, 0..n baris per resolusi, hanya untuk disposition='EMPLOYEE_CHARGE'.
// employeeName adalah sumber kebenaran (bebas teks) karena daftar `users` adalah daftar akun
// login, bukan daftar lengkap seluruh karyawan toko — penanggung jawab selisih bisa saja orang
// yang tidak/belum punya akun sistem. employeeId cuma link opsional kalau kebetulan cocok.
export const soResolutionEmployeeCharges = petshop.table('so_resolution_employee_charges', {
  id: serial('id').primaryKey(),
  resolutionId: integer('resolution_id').references(() => soVarianceResolutions.id).notNull(),
  employeeName: varchar('employee_name', { length: 150 }).notNull(),
  employeeId: integer('employee_id').references(() => users.id),
  amount: integer('amount').notNull(),
  note: varchar('note', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_so_resolution_employee_charges_resolution').on(t.resolutionId),
  index('idx_so_resolution_employee_charges_name').on(sql`lower(${t.employeeName})`),
]);
