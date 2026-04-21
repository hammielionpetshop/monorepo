import { serial, integer, decimal, timestamp, varchar, text, jsonb, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
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
  openingCash: decimal('opening_cash', { precision: 12, scale: 2 }).notNull(),
  targetEndTime: timestamp('target_end_time'),
  status: varchar('status', { length: 20 }).default('OPEN').notNull(), // OPEN | CLOSED | FORCE_CLOSED
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  // Settlement:
  closedById: integer('closed_by_id').references(() => users.id),
  closedAt: timestamp('closed_at'),
  totalClosingCashReal: decimal('total_closing_cash_real', { precision: 12, scale: 2 }),
  totalClosingCashExpected: decimal('total_closing_cash_expected', { precision: 12, scale: 2 }),
  totalVariance: decimal('total_variance', { precision: 12, scale: 2 }),
  settlementNotes: text('settlement_notes'),
  // Force close:
  forceClosedById: integer('force_closed_by_id').references(() => users.id),
  forceClosedAt: timestamp('force_closed_at'),
});

export const shiftCashierBreakdown = petshop.table('shift_cashier_breakdown', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  totalSalesCash: decimal('total_sales_cash', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesQris: decimal('total_sales_qris', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesDebit: decimal('total_sales_debit', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesCredit: decimal('total_sales_credit', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesDebt: decimal('total_sales_debt', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0').notNull(),
  totalTransactions: integer('total_transactions').default(0).notNull(),
  totalExpenses: decimal('total_expenses', { precision: 12, scale: 2 }).default('0').notNull(),
  modalShare: decimal('modal_share', { precision: 12, scale: 2 }),
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }),
  realCash: decimal('real_cash', { precision: 12, scale: 2 }),
  variance: decimal('variance', { precision: 12, scale: 2 }),
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
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note').notNull(),
  proofImage: text('proof_image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shiftCashierSessions = petshop.table('shift_cashier_sessions', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  stoppedAt: timestamp('stopped_at'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(), // ACTIVE | STOPPED
});
