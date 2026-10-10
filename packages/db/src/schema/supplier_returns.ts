import { serial, varchar, integer, timestamp, text, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { suppliers, unitsOfMeasure } from './master';
import { products } from './products';
import { users } from './users';
import { purchaseOrders, purchaseOrderItems, supplierPayablePayments } from './purchase_orders';

/**
 * Retur ke Supplier: barang yang SUDAH diterima lalu ketahuan rusak/expired dikembalikan ke
 * supplier. Beda arah dengan `returns` (retur dari pelanggan) dan beda makna dengan
 * `damaged_goods` (kerugian toko) — retur ini klaim ke supplier, nilainya kembali sebagai
 * potongan tagihan atau saldo supplier.
 *
 * Alur: PENDING (stok belum keluar) → APPROVED oleh OWNER/GM (stok dipotong FIFO, tagihan PO
 * asal dipotong lewat baris `supplier_payable_payments` bermetode RETUR, sisanya jadi saldo
 * di `supplier_credit_entries`) atau REJECTED (tidak ada yang berubah).
 */
export const supplierReturns = petshop.table('supplier_returns', {
  id: serial('id').primaryKey(),
  returnNumber: varchar('return_number', { length: 50 }).notNull().unique(), // RS-YYYYMMDD-XXXX
  supplierId: integer('supplier_id').references(() => suppliers.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  // PO asal — opsional. Kalau kosong, seluruh nilai retur langsung jadi saldo supplier.
  poId: integer('po_id').references(() => purchaseOrders.id),
  reason: varchar('reason', { length: 20 }).notNull(), // EXPIRED | RUSAK | SALAH_KIRIM | LAINNYA
  notes: text('notes').notNull(), // penjelasan wajib dari pengaju
  source: varchar('source', { length: 10 }).notNull(), // POS | BO
  // PENDING | APPROVED | REJECTED
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  totalValue: integer('total_value').notNull(), // nilai klaim ke supplier (Σ qty × harga)
  totalCogs: integer('total_cogs'), // modal FIFO stok yang benar-benar keluar — diisi saat APPROVED
  payableDeduction: integer('payable_deduction').default(0).notNull(), // bagian yang memotong tagihan PO asal
  creditAmount: integer('credit_amount').default(0).notNull(), // bagian yang jadi saldo supplier
  payablePaymentId: integer('payable_payment_id').references(() => supplierPayablePayments.id),
  requestedById: integer('requested_by_id').references(() => users.id).notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  resolvedById: integer('resolved_by_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  rejectionReason: text('rejection_reason'),
}, (t) => [
  index('idx_supplier_returns_status_branch').on(t.status, t.branchId),
  index('idx_supplier_returns_po').on(t.poId),
]);

export const supplierReturnItems = petshop.table('supplier_return_items', {
  id: serial('id').primaryKey(),
  supplierReturnId: integer('supplier_return_id').references(() => supplierReturns.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  poItemId: integer('po_item_id').references(() => purchaseOrderItems.id), // baris PO asal (bila ada)
  qty: integer('qty').notNull(),
  unitPrice: integer('unit_price').notNull(), // harga klaim per satuan (harga faktur/PO, atau modal terakhir)
  lineValue: integer('line_value').notNull(), // qty × unitPrice
  cogs: integer('cogs'), // modal FIFO nyata — diisi saat APPROVED
  photoUrl: text('photo_url'),
});

/**
 * Buku saldo supplier (uang kita yang "tertahan" di supplier). Saldo = Σ amount per supplier.
 * Masuk (+) dari retur yang melebihi sisa tagihan / tanpa PO; keluar (−) saat dipakai
 * membayar tagihan berikutnya (baris pembayaran bermetode SALDO).
 */
export const supplierCreditEntries = petshop.table('supplier_credit_entries', {
  id: serial('id').primaryKey(),
  supplierId: integer('supplier_id').references(() => suppliers.id).notNull(),
  amount: integer('amount').notNull(),
  sourceType: varchar('source_type', { length: 20 }).notNull(), // RETUR | PAKAI
  supplierReturnId: integer('supplier_return_id').references(() => supplierReturns.id),
  payablePaymentId: integer('payable_payment_id').references(() => supplierPayablePayments.id),
  note: text('note'),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_supplier_credit_entries_supplier').on(t.supplierId),
]);
