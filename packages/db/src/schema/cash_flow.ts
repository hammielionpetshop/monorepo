import { serial, integer, timestamp, varchar, unique, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';

export const cashFlowCategories = petshop.table(
  'cash_flow_categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull(),
    type: varchar('type', { length: 10 }).notNull(), // INCOME, EXPENSE
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('cash_flow_categories_name_type_unique').on(table.name, table.type),
  ]
);

export const cashFlowEntries = petshop.table('cash_flow_entries', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 10 }).notNull(), // INCOME, EXPENSE
  categoryId: integer('category_id').references(() => cashFlowCategories.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id),
  amount: integer('amount').notNull(),
  note: varchar('note', { length: 255 }),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('cash_flow_entries_branch_created_idx').on(t.branchId, t.createdAt),
]);
