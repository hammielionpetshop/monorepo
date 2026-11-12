import { serial, integer, timestamp, varchar, date, text, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { petshop } from './_schema';
import { users } from './users';
import { moneyPlaces } from './money_places';
import { cashFlowEntries } from './cash_flow';

/**
 * F2-6e-1 Hitung Kas (spec docs/work/specs/2026-11-12-f2-6e-hitung-kas-design.md §1): uang nyata Tunai/Rekening pada
 * akhir hari `counted_on`. Saldo sistem & selisih hanya dibaca web Finance. Tidak dihapus/diubah (trigger migrasi
 * 0069); yang boleh berubah hanya pembatalan sekali dan tautan penyesuaian (catatan Arus Kas kategori sistem).
 */
export const cashCounts = petshop.table('cash_counts', {
  id: serial('id').primaryKey(),
  moneyPlaceId: integer('money_place_id').references(() => moneyPlaces.id).notNull(),
  countedOn: date('counted_on').notNull(),
  amount: integer('amount').notNull(),
  note: text('note'),
  photoUrl: varchar('photo_url', { length: 300 }),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  /** Penyesuaian terakhir; aktif selama catatan Arus Kas-nya belum batal. */
  adjustmentCashFlowEntryId: integer('adjustment_cash_flow_entry_id').references(() => cashFlowEntries.id),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
}, (t) => [
  uniqueIndex('cash_counts_active_unique').on(t.moneyPlaceId, t.countedOn).where(sql`${t.cancelledAt} IS NULL`),
  index('cash_counts_counted_on_idx').on(t.countedOn),
]);
