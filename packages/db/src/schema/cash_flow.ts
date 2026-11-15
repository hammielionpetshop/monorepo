import { serial, integer, timestamp, varchar, unique, index, boolean, date, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { moneyPlaces } from './money_places';

/**
 * F2-4b (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §3.3): jenis laporan
 * COST biaya · NON_COST bukan biaya (EXPENSE) · INCOME pendapatan lain · NON_INCOME bukan pendapatan (INCOME).
 * NULL = jenis belum dipilih (kategori lama).
 */
export const cashFlowCategories = petshop.table(
  'cash_flow_categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull(),
    type: varchar('type', { length: 10 }).notNull(), // INCOME, EXPENSE
    createdAt: timestamp('created_at').defaultNow().notNull(),
    reportKind: varchar('report_kind', { length: 12 }),
    isActive: boolean('is_active').default(true).notNull(),
    /** Dibuat mesin (bayar utang internal manual); tidak bisa dipilih saat mencatat. */
    isSystem: boolean('is_system').default(false).notNull(),
    ownerOnly: boolean('owner_only').default(false).notNull(),
    noteRequired: boolean('note_required').default(false).notNull(),
  },
  (table) => [
    unique('cash_flow_categories_name_type_unique').on(table.name, table.type),
  ]
);

export const cashFlowEntries = petshop.table('cash_flow_entries', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 10 }).notNull(), // INCOME, EXPENSE
  categoryId: integer('category_id').references(() => cashFlowCategories.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id),
  amount: integer('amount').notNull(),
  note: varchar('note', { length: 255 }),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  /** Tanggal uang benar-benar masuk/keluar (WIB). */
  occurredOn: date('occurred_on').notNull().default(sql`((now() AT TIME ZONE 'Asia/Jakarta')::date)`),
  /** Bulan yang ditanggung (tanggal 1), terpisah dari tanggal bayar. */
  forMonth: date('for_month').notNull().default(sql`(date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')::date)`),
  /** Dibayar dari / masuk ke. Kosong = catatan lama "belum diketahui". */
  moneyPlaceId: integer('money_place_id').references(() => moneyPlaces.id),
  proofPhotoUrl: text('proof_photo_url'),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
  /** F2-6f-3 Koreksi bulan lalu: diisi = koreksi untuk "Untuk bulan" yang sudah ditutup (migrasi 0071). */
  correctionReason: text('correction_reason'),
}, (t) => [
  index('cash_flow_entries_branch_created_idx').on(t.branchId, t.createdAt),
]);

/**
 * F2-4c Pindah Dana (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §4): uang pindah antar
 * Tempat Uang; bukan biaya/pendapatan. Dicerminkan di money_movements (sumber TRANSFER). Tidak diubah/dihapus
 * (trigger migrasi 0061); batal = isi pembatalan + baris pembalikan negatif di money_movements.
 */
export const moneyTransfers = petshop.table('money_transfers', {
  id: serial('id').primaryKey(),
  fromMoneyPlaceId: integer('from_money_place_id').references(() => moneyPlaces.id).notNull(),
  toMoneyPlaceId: integer('to_money_place_id').references(() => moneyPlaces.id).notNull(),
  amount: integer('amount').notNull(),
  occurredOn: date('occurred_on').notNull(),
  note: text('note'),
  proofPhotoUrl: text('proof_photo_url'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
}, (t) => [
  index('idx_money_transfers_occurred').on(t.occurredOn),
]);
