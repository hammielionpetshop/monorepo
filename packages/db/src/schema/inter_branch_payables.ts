import { serial, integer, varchar, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { interBranchTransfers } from './inter_branch_transfers';

export const interBranchPayables = petshop.table('inter_branch_payables', {
  id: serial('id').primaryKey(),
  transferId: integer('transfer_id').references(() => interBranchTransfers.id).notNull(),
  debtorBranchId: integer('debtor_branch_id').references(() => branches.id).notNull(),
  creditorBranchId: integer('creditor_branch_id').references(() => branches.id).notNull(),
  totalAmount: integer('total_amount').notNull(),
  paidAmount: integer('paid_amount').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('UNPAID').notNull(),
  notes: text('notes'),
  dueAt: timestamp('due_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_ibp_transfer_unique').on(table.transferId),
]);

export const interBranchPayments = petshop.table('inter_branch_payments', {
  id: serial('id').primaryKey(),
  payableId: integer('payable_id').references(() => interBranchPayables.id).notNull(),
  amount: integer('amount').notNull(),
  paidByUserId: integer('paid_by_user_id').references(() => users.id),
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
  paidAt: timestamp('paid_at').defaultNow().notNull(),
});
