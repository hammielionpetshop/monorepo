import { serial, integer, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { customers, paymentMethods } from './master';
import { transactions } from './transactions';
import { branches } from './branches';
import { users } from './users';

export const customerDebts = petshop.table('customer_debts', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  branchId: integer('branch_id').references(() => branches.id),
  totalAmount: integer('total_amount').notNull(),
  paidAmount: integer('paid_amount').default(0).notNull(),
  remainingAmount: integer('remaining_amount').notNull(),
  dueAt: timestamp('due_at'),
  status: varchar('status', { length: 20 }).default('UNPAID').notNull(), // UNPAID, PARTIAL, PAID
  note: varchar('note', { length: 255 }),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_customer_debts_customer').on(t.customerId),
  index('idx_customer_debts_transaction').on(t.transactionId),
]);

export const debtPayments = petshop.table('debt_payments', {
  id: serial('id').primaryKey(),
  debtId: integer('debt_id').references(() => customerDebts.id).notNull(),
  amount: integer('amount').notNull(),
  paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id).notNull(),
  note: varchar('note', { length: 255 }),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  voidedAt: timestamp('voided_at'),
  voidedBy: integer('voided_by').references(() => users.id),
  voidReason: varchar('void_reason', { length: 255 }),
}, (t) => [
  index('idx_debt_payments_debt').on(t.debtId),
]);
