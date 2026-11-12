import { serial, integer, timestamp, varchar, date, text, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { cashFlowCategories, cashFlowEntries } from './cash_flow';

/**
 * F2-5a Biaya Rutin (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §2): biaya tetap
 * bulanan (sewa toko/kendaraan/lain). Tagihan dihitung dari pengaturan; yang disimpan hanya pembayarannya.
 * Tidak dihapus (trigger migrasi 0066); salah buat sebelum ada pembayaran = nonaktif.
 */
export const recurringCosts = petshop.table('recurring_costs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  categoryId: integer('category_id').references(() => cashFlowCategories.id).notNull(),
  /** Kosong = Bersama. */
  branchId: integer('branch_id').references(() => branches.id),
  dueDay: integer('due_day').notNull(),
  /** Bulan pertama bertagihan (tanggal 1). */
  startMonth: date('start_month').notNull(),
  /** Bulan terakhir bertagihan (tanggal 1); kosong = terus berjalan. */
  endMonth: date('end_month'),
  note: text('note'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at'),
});

/** Jumlah per bulan bertanggal: jumlah bulan X = baris dengan effective_month terbesar ≤ X. */
export const recurringCostAmounts = petshop.table('recurring_cost_amounts', {
  id: serial('id').primaryKey(),
  recurringCostId: integer('recurring_cost_id').references(() => recurringCosts.id).notNull(),
  amount: integer('amount').notNull(),
  effectiveMonth: date('effective_month').notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('recurring_cost_amounts_month_unique').on(t.recurringCostId, t.effectiveMonth),
]);

/**
 * Satu baris per bulan tagihan yang dibayar, bercermin satu catatan Arus Kas (Untuk bulan = for_month).
 * Bayar beberapa bulan sekaligus berbagi batch_key dan dibatalkan bersama.
 */
export const recurringCostPayments = petshop.table('recurring_cost_payments', {
  id: serial('id').primaryKey(),
  recurringCostId: integer('recurring_cost_id').references(() => recurringCosts.id).notNull(),
  forMonth: date('for_month').notNull(),
  billedAmount: integer('billed_amount').notNull(),
  amount: integer('amount').notNull(),
  differenceReason: text('difference_reason'),
  cashFlowEntryId: integer('cash_flow_entry_id').references(() => cashFlowEntries.id).notNull(),
  batchKey: varchar('batch_key', { length: 40 }).notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
}, (t) => [
  uniqueIndex('recurring_cost_payments_entry_unique').on(t.cashFlowEntryId),
  uniqueIndex('recurring_cost_payments_month_unique').on(t.recurringCostId, t.forMonth).where(sql`${t.cancelledAt} is null`),
  index('recurring_cost_payments_batch_idx').on(t.batchKey),
]);
