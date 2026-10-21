import { serial, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { transactions, transactionItems } from './transactions';
import { users } from './users';

// Catatan potongan per baris nota (migrasi 0043) — lihat
// docs/work/specs/2026-10-12-promo-otomatis-design.md. Satu baris per potongan; jumlah potongan
// satu baris nota = `transaction_items.discount_amount`. Tanpa edit/hapus: nota yang dibatalkan
// tetap menyimpan catatannya (laporan menyaring lewat status nota).
export const transactionItemDiscounts = petshop.table('transaction_item_discounts', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  transactionItemId: integer('transaction_item_id').references(() => transactionItems.id).notNull(),
  kind: varchar('kind', { length: 10 }).notNull(), // MANUAL, PROMO
  amount: integer('amount').notNull(), // rupiah, potongan untuk seluruh baris (bukan per pcs)
  // Diskon manual: alasan pilihan + catatan bila "Lainnya".
  reasonCode: varchar('reason_code', { length: 30 }),
  reasonNote: text('reason_note'),
  // Diskon manual mode PERSEN (migrasi 0048): persentase bulat yang diketik kasir (1–100). NULL =
  // diskon rupiah (per pcs / per baris). Hanya untuk ditampilkan ("Diskon 10%") — `amount` tetap
  // sumber nilai uang. Tidak diturunkan dari amount/gross karena pembulatan ke bawah bikin ambigu.
  percent: integer('percent'),
  // Promo: id + salinan nama & aturan saat nota terbit. Tabel promo dibuat di tahap P2, jadi
  // belum ada foreign key.
  promotionId: integer('promotion_id'),
  promotionName: varchar('promotion_name', { length: 100 }),
  promotionSnapshot: jsonb('promotion_snapshot'),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_transaction_item_discounts_item').on(t.transactionItemId),
  index('idx_transaction_item_discounts_transaction').on(t.transactionId),
  index('idx_transaction_item_discounts_kind_created').on(t.kind, t.createdAt),
]);
