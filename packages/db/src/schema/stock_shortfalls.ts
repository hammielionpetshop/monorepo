import { sql } from 'drizzle-orm';
import { serial, integer, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { products } from './products';
import { transactions, transactionItems } from './transactions';

// Ledger "utang stok" untuk oversell (jual/koreksi nota melebihi stok tercatat). Sebelum ini,
// kekurangan cuma tercatat di auditLogs (action OVERSELL) dan tidak pernah jadi angka —
// product_stocks.qty di-floor ke 0, jadi barang masuk berikutnya dianggap 100% stok baru padahal
// sebagian sebenarnya cuma menutup kekurangan lama. Baris ini yang menjelaskan kenapa
// product_stocks.qty boleh minus (lihat komentar di stock-service.ts deductStock/addStock).
// Status TIDAK disimpan sebagai kolom — diturunkan dari timestamp saat query:
// writtenOffAt terisi → written_off; else qtyRemaining=0 → cleared;
// else qtyRemaining<qtyShort → partially_cleared; else → open.
export const stockShortfalls = petshop.table('stock_shortfalls', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  qtyShort: integer('qty_short').notNull(), // immutable, base UOM
  qtyRemaining: integer('qty_remaining').notNull(), // turun seiring dilunasi lewat stock_shortfall_clearings
  costPricePerUnit: integer('cost_price_per_unit').notNull(), // fallback cost per base UOM saat oversell terjadi
  sourceType: varchar('source_type', { length: 20 }).notNull(), // SALE, TRX_EDIT
  sourceTransactionId: integer('source_transaction_id').references(() => transactions.id),
  sourceTransactionItemId: integer('source_transaction_item_id').references(() => transactionItems.id),
  closedAt: timestamp('closed_at'), // terisi saat qtyRemaining habis lewat clearing (PO/SO/adjustment)
  writtenOffAt: timestamp('written_off_at'), // ditutup manual (barang terbukti hilang/rusak, bukan cuma telat input)
  writtenOffById: integer('written_off_by_id').references(() => users.id),
  writeOffReason: varchar('write_off_reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  // Urutan pelunasan FIFO: utang tertua per (cabang, produk) dilunasi duluan oleh barang masuk.
  index('idx_stock_shortfalls_open_fifo').on(t.branchId, t.productId, t.createdAt)
    .where(sql`${t.closedAt} IS NULL AND ${t.writtenOffAt} IS NULL`),
  index('idx_stock_shortfalls_branch_created').on(t.branchId, t.createdAt),
]);

// Satu baris per kejadian pelunasan (sebagian/penuh) — satu shortfall bisa dilunasi bertahap
// lewat beberapa penerimaan PO berbeda. costPriceAtClearing dipakai untuk true-up HPP nota asal
// kalau beda dari costPricePerUnit yang dipakai saat shortfall dibuat.
export const stockShortfallClearings = petshop.table('stock_shortfall_clearings', {
  id: serial('id').primaryKey(),
  shortfallId: integer('shortfall_id').references(() => stockShortfalls.id).notNull(),
  qtyCleared: integer('qty_cleared').notNull(),
  costPriceAtClearing: integer('cost_price_at_clearing').notNull(),
  // PO_RECEIVING, STOCK_OPNAME, MANUAL_ADJUSTMENT. referenceId polimorfik (poId / soId / stockAdjustmentId)
  // tanpa FK tunggal — pola sama seperti auditLogs.recordId, karena targetnya beda tabel per jenis.
  referenceType: varchar('reference_type', { length: 20 }).notNull(),
  referenceId: integer('reference_id'),
  reversedAt: timestamp('reversed_at'), // disiapkan untuk reversal reverse-receiving PO di kerjaan lanjutan
  clearedAt: timestamp('cleared_at').defaultNow().notNull(),
}, (t) => [
  index('idx_stock_shortfall_clearings_shortfall').on(t.shortfallId),
  index('idx_stock_shortfall_clearings_reference').on(t.referenceType, t.referenceId),
]);
