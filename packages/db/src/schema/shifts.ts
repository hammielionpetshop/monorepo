import { serial, integer, decimal, timestamp, varchar, text } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { expenseCategories, paymentMethods } from './master';

export const shifts = petshop.table('shifts', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  openedById: integer('opened_by_id').references(() => users.id).notNull(),
  closedById: integer('closed_by_id').references(() => users.id),
  openingCash: decimal('opening_cash', { precision: 12, scale: 2 }).notNull(),
  closingCash: decimal('closing_cash', { precision: 12, scale: 2 }),
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 20 }).default('OPEN').notNull(), // OPEN, CLOSED
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
});

export const shiftCashierBreakdown = petshop.table('shift_cashier_breakdown', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  expectedAmount: decimal('expected_amount', { precision: 12, scale: 2 }).notNull(),
  realAmount: decimal('real_amount', { precision: 12, scale: 2 }),
  varianceAmount: decimal('variance_amount', { precision: 12, scale: 2 }),
  paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id).notNull(),
});

export const shiftExpenses = petshop.table('shift_expenses', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  categoryId: integer('category_id').references(() => expenseCategories.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
  proofImage: text('proof_image'), // URL to image
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
