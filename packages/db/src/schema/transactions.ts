import { serial, varchar, text, integer, timestamp, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { unitsOfMeasure, customers, paymentMethods } from './master';
import { products } from './products';
import { users } from './users';
import { interBranchTransfers } from './inter_branch_transfers';

export const transactions = petshop.table('transactions', {
  id: serial('id').primaryKey(),
  trxNumber: varchar('trx_number', { length: 50 }).notNull().unique(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').notNull(), // Cross-ref to shifts.ts
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  totalAmount: integer('total_amount').notNull(),
  discountAmount: integer('discount_amount').default(0).notNull(),
  taxAmount: integer('tax_amount').default(0).notNull(),
  payableAmount: integer('payable_amount').notNull(),
  paidAmount: integer('paid_amount').notNull(),
  changeAmount: integer('change_amount').notNull(),
  status: varchar('status', { length: 20 }).default('COMPLETED').notNull(), // COMPLETED, VOIDED, PENDING_VOID
  revision: integer('revision').default(1).notNull(), // naik 1 tiap koreksi transaksi
  saleType: varchar('sale_type', { length: 10 }).default('RETAIL').notNull(), // RETAIL, BULK
  sourceIbtId: integer('source_ibt_id').references(() => interBranchTransfers.id), // Internal PO sumber (bulk sale hasil import IBT)
  sourceOrderId: integer('source_order_id'), // Cross-ref ke customer_orders.id (bulk sale hasil konversi order portal) — plain integer untuk hindari circular import

  createdOffline: boolean('created_offline').default(false).notNull(),
  offlineTimestamp: timestamp('offline_timestamp'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_transactions_customer_created').on(t.customerId, t.createdAt),
  index('idx_transactions_branch_created').on(t.branchId, t.createdAt),
  index('idx_transactions_shift').on(t.shiftId),
  index('idx_transactions_sale_type').on(t.saleType),
]);

export const transactionItems = petshop.table('transaction_items', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: varchar('product_name', { length: 255 }), // snapshot nama produk saat transaksi
  productSku: varchar('product_sku', { length: 50 }), // snapshot SKU saat transaksi
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qty: integer('qty').notNull(),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
  discountAmount: integer('discount_amount').default(0).notNull(),
  priceTier: varchar('price_tier', { length: 20 }).notNull(),
  cogs: integer('cogs'), // Cost per Base Uom * Qty (in base)
  // Snapshot saat nota pertama terbit — hanya terisi bila item pernah dikoreksi.
  // NULL = belum pernah dikoreksi (qty & cogs di atas masih angka aslinya).
  // Buku besar stok memakai ini untuk baris SALE_OUT di jam jual, sementara selisih
  // terhadap qty berjalan jadi baris EDIT_IN/EDIT_OUT di jam koreksi — tanpa ini
  // mutasi stok masa lalu ikut berubah surut dan buku besar dobel-hitung.
  originalQty: integer('original_qty'),
  originalCogs: integer('original_cogs'),
  // Item yang dihapus lewat koreksi. Barisnya sengaja dipertahankan (qty jadi 0)
  // supaya SALE_OUT aslinya tidak lenyap dari buku besar.
  isRemoved: boolean('is_removed').default(false).notNull(),
}, (t) => [
  index('idx_transaction_items_transaction').on(t.transactionId),
]);

// Riwayat koreksi transaksi — satu baris per revisi, menyimpan snapshot utuh
// sebelum & sesudah agar owner bisa menelusuri apa yang diubah tanpa merekonstruksi.
export const transactionEdits = petshop.table('transaction_edits', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  revision: integer('revision').notNull(), // revisi hasil koreksi ini (2, 3, ...)
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').notNull(),
  editedById: integer('edited_by_id').references(() => users.id).notNull(), // kasir yang mengetik koreksi
  approvedById: integer('approved_by_id').references(() => users.id), // pemilik PIN yang menyetujui
  reason: text('reason').notNull(),
  beforeData: jsonb('before_data').notNull(),
  afterData: jsonb('after_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_transaction_edits_transaction').on(t.transactionId),
  uniqueIndex('uq_transaction_edits_trx_revision').on(t.transactionId, t.revision),
]);

export const transactionPayments = petshop.table('transaction_payments', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id).notNull(),
  amount: integer('amount').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
}, (t) => [
  index('idx_transaction_payments_transaction').on(t.transactionId),
]);

export const openBills = petshop.table('open_bills', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').notNull(),
  billName: varchar('bill_name', { length: 100 }),
  customerId: integer('customer_id').references(() => customers.id),
  items: jsonb('items').notNull(), // Draft items as JSON
  totalAmount: integer('total_amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
