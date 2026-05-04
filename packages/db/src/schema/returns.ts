import { uuid, varchar, text, decimal, timestamp, integer } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { transactions, transactionItems } from './transactions';
import { branches } from './branches';
import { users } from './users';
import { products } from './products';
import { unitsOfMeasure } from './master';

export const returns = petshop.table('returns', {
  id: uuid('id').defaultRandom().primaryKey(),
  returnNumber: varchar('return_number', { length: 50 }).notNull().unique(),
  transactionId: integer('transaction_id').notNull().references(() => transactions.id),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  processedById: integer('processed_by_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  totalRefundAmount: decimal('total_refund_amount', { precision: 15, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const returnItems = petshop.table('return_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  returnId: uuid('return_id').notNull().references(() => returns.id),
  transactionItemId: integer('transaction_item_id').notNull().references(() => transactionItems.id),
  productId: integer('product_id').notNull().references(() => products.id),
  uomId: integer('uom_id').notNull().references(() => unitsOfMeasure.id),
  qty: decimal('qty', { precision: 15, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),
  cogs: decimal('cogs', { precision: 15, scale: 4 }).notNull(),
  refundAmount: decimal('refund_amount', { precision: 15, scale: 4 }).notNull(),
});
