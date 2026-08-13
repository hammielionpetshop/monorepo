import { serial, varchar, integer, timestamp, text, date, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { unitsOfMeasure } from './master';
import { products } from './products';
import { users } from './users';

export const interBranchTransfers = petshop.table('inter_branch_transfers', {
  id: serial('id').primaryKey(),
  ibtNumber: varchar('ibt_number', { length: 50 }).notNull().unique(),
  sourceBranchId: integer('source_branch_id').references(() => branches.id).notNull(),
  destinationBranchId: integer('destination_branch_id').references(() => branches.id).notNull(),
  requestedById: integer('requested_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  receivedById: integer('received_by_id').references(() => users.id),
  receivedAt: timestamp('received_at'),
  status: varchar('status', { length: 20 }).default('DRAFT').notNull(),
  totalTransferValue: integer('total_transfer_value').default(0).notNull(),
  // Transaksi bulk sale hasil konversi IBT ini (G4). Diisi saat IBT diproses via bulk sale;
  // dipakai G5 untuk skip pemotongan stok gudang kedua saat ship. FK dibuat via migrasi
  // (kolom polos di schema untuk hindari import melingkar dengan transactions).
  convertedTransactionId: integer('converted_transaction_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  // Cabang user bisa muncul sebagai asal ATAU tujuan, jadi kondisinya `OR` dan satu indeks
  // gabungan tidak bisa melayani keduanya — dua indeks, masing-masing satu sisi, digabung
  // Postgres lewat BitmapOr. `status` di depan supaya kasus OWNER/GM (tanpa filter cabang)
  // tetap terlayani lewat prefix.
  index('idx_ibt_status_source').on(t.status, t.sourceBranchId),
  index('idx_ibt_status_destination').on(t.status, t.destinationBranchId),
]);

export const interBranchTransferItems = petshop.table('inter_branch_transfer_items', {
  id: serial('id').primaryKey(),
  transferId: integer('transfer_id').references(() => interBranchTransfers.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qtyRequested: integer('qty_requested').notNull(),
  qtyShipped: integer('qty_shipped').default(0).notNull(),
  qtyReceived: integer('qty_received').default(0).notNull(),
  receiveNotes: text('receive_notes'),
  costPriceAtTransfer: integer('cost_price_at_transfer').default(0).notNull(),
  expiryDate: date('expiry_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
