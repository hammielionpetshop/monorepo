import { serial, integer, timestamp, date, text, boolean, jsonb, unique } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { users } from './users';

/**
 * F2-6f Tutup Bulan (spec docs/work/specs/2026-11-12-f2-6f-tutup-bulan-design.md §1): satu baris per bulan yang ditutup
 * Owner/GM di web Finance, berisi salinan Laba Rugi & saldo akhir bulan saat ditutup. Tidak diubah/dihapus (trigger
 * migrasi 0070); catatan uang Back Office bertanggal di bulan tertutup ditolak database (galat HM001).
 */
export const monthClosings = petshop.table('month_closings', {
  id: serial('id').primaryKey(),
  /** Tanggal 1 bulan yang ditutup. */
  month: date('month').notNull(),
  closedBy: integer('closed_by').references(() => users.id).notNull(),
  closedAt: timestamp('closed_at').defaultNow().notNull(),
  /** "Ditutup dengan catatan": masih ada yang belum beres saat ditutup. */
  withNotes: boolean('with_notes').default(false).notNull(),
  note: text('note'),
  openItems: jsonb('open_items').notNull().default([]),
  snapshot: jsonb('snapshot').notNull(),
}, (t) => [
  unique('month_closings_month_unique').on(t.month),
]);
