import { serial, integer, timestamp, varchar, text, jsonb, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { transactions } from './transactions';
import { products } from './products';

export const ownerPriceOverrides = petshop.table('owner_price_overrides', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  overrideById: integer('override_by_id').references(() => users.id).notNull(), // Owner/Manager who entered PIN
  originalPrice: integer('original_price').notNull(),
  overriddenPrice: integer('overridden_price').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Permintaan persetujuan dari kasir. Namanya masih `void_requests` karena awalnya hanya
// melayani void; sejak #6 ia menampung dua jenis — lihat `kind`. Tabel sengaja tidak diganti
// nama: menyalin 20+ pemakaian demi kerapian nama tidak sebanding risikonya.
export const voidRequests = petshop.table('void_requests', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  requestById: integer('request_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  // VOID = batalkan seluruh nota. KOREKSI = ubah isinya sesuai `payload`.
  kind: varchar('kind', { length: 20 }).default('VOID').notNull(),
  // Muatan koreksi yang diajukan kasir (item, pembayaran, customer, jatuh tempo) — bentuknya
  // sama dengan body `POST /api/pos/transactions/[id]/edit`. NULL untuk permintaan VOID.
  //
  // Disimpan apa adanya dan divalidasi ULANG saat disetujui, bukan saat diajukan: di antara
  // keduanya harga, stok, bahkan status notanya bisa berubah. Menerapkan muatan basi tanpa
  // memeriksa berarti menyetujui sesuatu yang berbeda dari yang dilihat kasir.
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  // Badge "persetujuan void" hanya dihitung untuk OWNER/GM, dan selalu tanpa filter cabang —
  // jadi `status` sendirian sudah cukup, tidak perlu kolom kedua.
  index('idx_void_requests_status').on(t.status),
]);

export const auditLogs = petshop.table('audit_logs', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  tableName: varchar('table_name', { length: 50 }),
  recordId: text('record_id'),
  oldData: text('old_data'), // JSON string
  newData: text('new_data'), // JSON string
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
