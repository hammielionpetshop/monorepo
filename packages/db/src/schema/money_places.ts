import { serial, integer, timestamp, varchar, boolean, date, text, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { paymentMethods } from './master';

/**
 * Tempat Uang (Fase 2 F2-1, spec docs/work/specs/2026-11-08-f2-1-tempat-uang-design.md):
 * satu daftar laci, kas tunai, dan rekening untuk semua web. Tidak pernah dihapus (dijaga trigger).
 * Laci kasir (`DRAWER`) dibuat & dinamai otomatis oleh trigger di `petshop.branches`.
 * Aturan lain (rekening wajib nomor, laci dipegang toko) dijaga CHECK di migrasi 0055.
 */
export const moneyPlaces = petshop.table('money_places', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  /** DRAWER laci kasir · CASH tunai lain (kas Finance, brankas, uang pegangan) · BANK rekening. */
  kind: varchar('kind', { length: 10 }).notNull(),
  /** Cabang pemilik (brankas/kas kantor = cabang Gudang). */
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'cascade' }).notNull(),
  bankName: varchar('bank_name', { length: 50 }),
  accountNumber: varchar('account_number', { length: 50 }),
  accountHolder: varchar('account_holder', { length: 100 }),
  /** Dipegang oleh: FINANCE · STORE · OTHER. Disalin ke baris verifikasi (F2-2/F2-3), jadi tidak bertanggal. */
  heldBy: varchar('held_by', { length: 10 }).notNull().default('FINANCE'),
  holderNote: varchar('holder_note', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
}, (t) => [
  uniqueIndex('uq_money_places_name').on(sql`lower(${t.name})`).where(sql`${t.kind} <> 'DRAWER'`),
  uniqueIndex('uq_money_places_drawer_branch').on(t.branchId).where(sql`${t.kind} = 'DRAWER'`),
  index('idx_money_places_branch').on(t.branchId),
]);

/**
 * Metode bayar non-tunai di satu cabang masuk ke Tempat Uang mana (mis. QRIS Toko B → Rekening Toko B).
 * Pengaturan, bukan data uang: boleh diganti; F2-2 menyalin tempat uangnya ke tiap baris verifikasi.
 */
export const paymentMethodMoneyPlaces = petshop.table('payment_method_money_places', {
  paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id, { onDelete: 'cascade' }).notNull(),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'cascade' }).notNull(),
  moneyPlaceId: integer('money_place_id').references(() => moneyPlaces.id).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
}, (t) => [
  primaryKey({ columns: [t.paymentMethodId, t.branchId] }),
  index('idx_payment_method_money_places_place').on(t.moneyPlaceId),
]);

/**
 * F2-6a-1 Saldo awal Tempat Uang (spec docs/work/specs/2026-11-12-f2-6-modul-finance-design.md §2): saldo
 * Tunai/Rekening per 1 November 2026 awal hari, titik mulai saldo yang dibaca Finance. Tidak diubah/dihapus
 * (trigger migrasi 0067); salah = batal beralasan lalu isi ulang. Satu yang berlaku per tempat.
 */
export const moneyPlaceOpeningBalances = petshop.table('money_place_opening_balances', {
  id: serial('id').primaryKey(),
  moneyPlaceId: integer('money_place_id').references(() => moneyPlaces.id).notNull(),
  asOf: date('as_of').notNull().default('2026-11-01'),
  amount: integer('amount').notNull(),
  note: text('note'),
  proofPhotoUrl: varchar('proof_photo_url', { length: 300 }),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
}, (t) => [
  uniqueIndex('money_place_opening_balances_active_unique').on(t.moneyPlaceId).where(sql`${t.cancelledAt} is null`),
]);
