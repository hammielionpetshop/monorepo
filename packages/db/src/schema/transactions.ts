import { serial, varchar, decimal, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { petshop } from './_schema.js';
import { branches } from './branches.js';
import { unitsOfMeasure, categories, brands, suppliers, customers, paymentMethods, expenseCategories } from './master.js';
import { products } from './products.js';

export const transactions = petshop.table('transactions', {
  id: serial('id').primaryKey(),
  trxNumber: varchar('trx_number', { length: 50 }).notNull().unique(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').notNull(), // Cross-ref to shifts.ts
  customerId: integer('customer_id').references(() => customers.id),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  payableAmount: decimal('payable_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).notNull(),
  changeAmount: decimal('change_amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('COMPLETED').notNull(), // COMPLETED, VOIDED, PENDING_VOID
  createdOffline: boolean('created_offline').default(false).notNull(),
  offlineTimestamp: timestamp('offline_timestamp'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactionItems = petshop.table('transaction_items', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qty: decimal('qty', { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  priceTier: varchar('price_tier', { length: 20 }).notNull(),
  cogs: decimal('cogs', { precision: 12, scale: 2 }), // Cost per Base Uom * Qty (in base)
});

export const transactionPayments = petshop.table('transaction_payments', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
});

export const openBills = petshop.table('open_bills', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').notNull(),
  billName: varchar('bill_name', { length: 100 }),
  customerId: integer('customer_id').references(() => customers.id),
  items: jsonb('items').notNull(), // Draft items as JSON
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
