import { serial, integer, timestamp, varchar, text, jsonb, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { expenseCategories } from './master';

export const shifts = petshop.table('shifts', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  openedById: integer('opened_by_id').references(() => users.id).notNull(),
  shiftNumber: integer('shift_number').notNull(),
  assignedCashiers: jsonb('assigned_cashiers').notNull(), // number[] — user IDs
  openingCash: integer('opening_cash').notNull(),
  targetEndTime: timestamp('target_end_time'),
  status: varchar('status', { length: 20 }).default('OPEN').notNull(), // OPEN | CLOSED | FORCE_CLOSED
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  // Settlement:
  closedById: integer('closed_by_id').references(() => users.id),
  closedAt: timestamp('closed_at'),
  totalClosingCashReal: integer('total_closing_cash_real'),
  totalClosingCashExpected: integer('total_closing_cash_expected'),
  totalVariance: integer('total_variance'),
  settlementNotes: text('settlement_notes'),
  // Force close:
  forceClosedById: integer('force_closed_by_id').references(() => users.id),
  forceClosedAt: timestamp('force_closed_at'),
}, (t) => [
  index('idx_shifts_branch_status').on(t.branchId, t.status),
]);

export const shiftCashierBreakdown = petshop.table('shift_cashier_breakdown', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  totalSalesCash: integer('total_sales_cash').default(0).notNull(),
  totalSalesQris: integer('total_sales_qris').default(0).notNull(),
  totalSalesDebit: integer('total_sales_debit').default(0).notNull(),
  totalSalesCredit: integer('total_sales_credit').default(0).notNull(),
  totalSalesDebt: integer('total_sales_debt').default(0).notNull(),
  totalSales: integer('total_sales').default(0).notNull(),
  totalTransactions: integer('total_transactions').default(0).notNull(),
  totalExpenses: integer('total_expenses').default(0).notNull(),
  modalShare: integer('modal_share'),
  expectedCash: integer('expected_cash'),
  realCash: integer('real_cash'),
  variance: integer('variance'),
  isVarianceFlagged: boolean('is_variance_flagged').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    shiftCashierIdx: uniqueIndex('shift_cashier_idx').on(table.shiftId, table.cashierId),
  };
});

export const shiftExpenses = petshop.table('shift_expenses', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  categoryId: integer('category_id').references(() => expenseCategories.id), // nullable
  categoryCustom: varchar('category_custom', { length: 100 }),
  amount: integer('amount').notNull(),
  note: text('note').notNull(),
  proofImage: text('proof_image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_shift_expenses_shift').on(t.shiftId),
]);

export const shiftCashierSessions = petshop.table('shift_cashier_sessions', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  stoppedAt: timestamp('stopped_at'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(), // ACTIVE | STOPPED
});
