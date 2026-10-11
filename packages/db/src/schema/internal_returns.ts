import { serial, varchar, integer, timestamp, text, uuid, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { unitsOfMeasure } from './master';
import { products } from './products';
import { users } from './users';
import { transactions, transactionItems } from './transactions';
import { returns } from './returns';
import { interBranchTransfers, interBranchTransferItems } from './inter_branch_transfers';
import { interBranchPayables, interBranchPayments } from './inter_branch_payables';

/**
 * Retur Internal (RI4, docs/work/specs/2026-10-11-retur-internal-design.md): jalan keluar
 * berdokumen untuk kiriman antar cabang (PO Internal → Bulk Sale pengirim → IBT) yang sudah
 * diterima. Dua jenis:
 * - BARANG_DIKEMBALIKAN — barang tercatat tapi tidak datang / dikembalikan (stok bagus saja):
 *   stok penerima keluar, stok cabang pengirim masuk lagi, nota Bulk Sale diretur
 *   (`saleReturnId`), hutang internal dipotong, kelebihannya jadi Saldo Internal.
 * - REVISI_HARGA — harga nota salah: stok tidak bergerak, modal sisa batch dibetulkan, bagian
 *   yang sudah terpakai jadi "Penyesuaian Modal" (`cogsAdjustment`), hutang dipotong selisih.
 *
 * Alur status sama dengan Retur Supplier Luar: PENDING → APPROVED | REJECTED (Owner/GM);
 * PENDING → WITHDRAWN (ditarik pengaju, memakai kolom resolved_*); APPROVED → CANCELLED
 * (Owner/GM, alasan wajib, semua efek dibalik berjejak). Dokumen tidak pernah dihapus.
 */
export const internalReturns = petshop.table('internal_returns', {
  id: serial('id').primaryKey(),
  returnNumber: varchar('return_number', { length: 50 }).notNull().unique(), // RI-YYYYMMDD-XXXX
  kind: varchar('kind', { length: 30 }).notNull(), // BARANG_DIKEMBALIKAN | REVISI_HARGA
  // Kode transaksi asal (wajib): IBT + nota Bulk Sale cabang pengirim.
  transferId: integer('transfer_id').references(() => interBranchTransfers.id).notNull(),
  saleTransactionId: integer('sale_transaction_id').references(() => transactions.id).notNull(),
  payableId: integer('payable_id').references(() => interBranchPayables.id), // hutang internal IBT itu (bila sudah ada)
  requestBranchId: integer('request_branch_id').references(() => branches.id).notNull(), // cabang pengaju
  receiverBranchId: integer('receiver_branch_id').references(() => branches.id).notNull(), // = IBT destination (berhutang)
  senderBranchId: integer('sender_branch_id').references(() => branches.id).notNull(), // = IBT source (Gudang atau toko)
  reason: varchar('reason', { length: 20 }).notNull(), // TIDAK_DATANG | SALAH_KIRIM | SALAH_HARGA | LAINNYA
  notes: text('notes').notNull(), // penjelasan wajib dari pengaju
  source: varchar('source', { length: 10 }).notNull(), // POS | BO
  // PENDING | APPROVED | REJECTED | WITHDRAWN | CANCELLED
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  totalValue: integer('total_value').notNull(), // nilai dokumen — dihitung ulang saat APPROVED
  payableDeduction: integer('payable_deduction').default(0).notNull(), // bagian yang memotong hutang internal IBT itu
  creditAmount: integer('credit_amount').default(0).notNull(), // bagian yang jadi Saldo Internal
  cogsAdjustment: integer('cogs_adjustment').default(0).notNull(), // REVISI_HARGA: Penyesuaian Modal untuk barang terpakai
  payablePaymentId: integer('payable_payment_id').references(() => interBranchPayments.id), // baris potongan hutang
  saleReturnId: uuid('sale_return_id').references(() => returns.id), // BARANG_DIKEMBALIKAN: retur nota Bulk Sale
  requestedById: integer('requested_by_id').references(() => users.id).notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  resolvedById: integer('resolved_by_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  rejectionReason: text('rejection_reason'),
  cancelledById: integer('cancelled_by_id').references(() => users.id),
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
}, (t) => [
  index('idx_internal_returns_status_receiver').on(t.status, t.receiverBranchId),
  index('idx_internal_returns_status_sender').on(t.status, t.senderBranchId),
  index('idx_internal_returns_transfer').on(t.transferId),
]);

export const internalReturnItems = petshop.table('internal_return_items', {
  id: serial('id').primaryKey(),
  internalReturnId: integer('internal_return_id').references(() => internalReturns.id).notNull(),
  transferItemId: integer('transfer_item_id').references(() => interBranchTransferItems.id).notNull(),
  saleItemId: integer('sale_item_id').references(() => transactionItems.id), // baris nota Bulk Sale yang cocok
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  // BARANG_DIKEMBALIKAN: qty yang dikembalikan. REVISI_HARGA: qty kiriman yang direvisi harganya.
  qty: integer('qty').notNull(),
  oldUnitPrice: integer('old_unit_price').notNull(), // harga nota (cost_price_at_transfer)
  proposedUnitPrice: integer('proposed_unit_price'), // REVISI_HARGA: usulan pemohon
  finalUnitPrice: integer('final_unit_price'), // REVISI_HARGA: harga yang disetujui (boleh diubah penyetuju)
  lineValue: integer('line_value').notNull(), // nilai baris (qty × harga, atau qty × selisih harga)
  cogs: integer('cogs'), // BARANG_DIKEMBALIKAN: modal FIFO yang keluar dari penerima — diisi saat APPROVED
  qtyConsumed: integer('qty_consumed'), // REVISI_HARGA: qty kiriman yang sudah terpakai saat disetujui
  cogsAdjustment: integer('cogs_adjustment'), // REVISI_HARGA: qtyConsumed × (harga lama − harga final)
  photoUrl: text('photo_url'),
}, (t) => [
  index('idx_internal_return_items_return').on(t.internalReturnId),
  index('idx_internal_return_items_transfer_item').on(t.transferItemId),
]);

/**
 * Buku Saldo Internal per pasangan cabang penerima (debtor) → pengirim (creditor). Saldo =
 * Σ amount per pasangan. Masuk (+) dari Retur Internal yang melebihi sisa hutang; keluar (−)
 * saat otomatis memotong tagihan internal terbuka (pembayaran sumber SALDO_INTERNAL) atau saat
 * dokumennya dibatalkan. Bukan uang kas — tidak pernah membuat catatan Pendapatan & Pengeluaran.
 */
export const internalCreditEntries = petshop.table('internal_credit_entries', {
  id: serial('id').primaryKey(),
  debtorBranchId: integer('debtor_branch_id').references(() => branches.id).notNull(),
  creditorBranchId: integer('creditor_branch_id').references(() => branches.id).notNull(),
  amount: integer('amount').notNull(),
  sourceType: varchar('source_type', { length: 20 }).notNull(), // RETUR_INTERNAL | PAKAI | BATAL_RETUR
  internalReturnId: integer('internal_return_id').references(() => internalReturns.id),
  payableId: integer('payable_id').references(() => interBranchPayables.id), // tagihan yang dipotong (PAKAI)
  paymentId: integer('payment_id').references(() => interBranchPayments.id), // baris pembayaran SALDO_INTERNAL
  note: text('note'),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_internal_credit_entries_pair').on(t.debtorBranchId, t.creditorBranchId),
]);
