import { serial, varchar, integer, timestamp, text } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { transactions } from './transactions';
import { users } from './users';

export const deliveryOrders = petshop.table('delivery_orders', {
  id: serial('id').primaryKey(),
  doNumber: varchar('do_number', { length: 50 }).notNull().unique(), // DO-YYYYMMDD-XXXX
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  customerName: varchar('customer_name', { length: 100 }).notNull(),
  customerAddress: text('customer_address'),
  totalWeightGram: integer('total_weight_gram'),
  printedById: integer('printed_by_id').references(() => users.id).notNull(),
  printedAt: timestamp('printed_at').defaultNow().notNull(),
  notes: text('notes'),
});
