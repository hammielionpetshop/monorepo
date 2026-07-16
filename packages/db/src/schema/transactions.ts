import { serial, varchar, integer, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
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
}, (t) => [
  index('idx_transaction_items_transaction').on(t.transactionId),
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
