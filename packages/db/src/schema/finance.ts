import { serial, integer, decimal, timestamp, varchar } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { customers, paymentMethods } from './master';
import { transactions } from './transactions';

export const customerDebts = petshop.table('customer_debts', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  remainingAmount: decimal('remaining_amount', { precision: 12, scale: 2 }).notNull(),
  dueAt: timestamp('due_at'),
  status: varchar('status', { length: 20 }).default('UNPAID').notNull(), // UNPAID, PARTIAL, PAID
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const debtPayments = petshop.table('debt_payments', {
  id: serial('id').primaryKey(),
  debtId: integer('debt_id').references(() => customerDebts.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
