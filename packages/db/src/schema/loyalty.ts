import { serial, integer, timestamp, varchar } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { customers } from './master';
import { transactions } from './transactions';

export const customerPoints = petshop.table('customer_points', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull().unique(),
  balance: integer('balance').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pointTransactions = petshop.table('point_transactions', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  type: varchar('type', { length: 20 }).notNull(), // EARNED, REDEEMED, EXPIRED, ADJUSTED
  points: integer('points').notNull(),
  note: varchar('note', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
