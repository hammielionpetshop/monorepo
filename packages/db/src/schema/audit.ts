import { serial, integer, decimal, timestamp, varchar, text } from 'drizzle-orm/pg-core';
import { petshop } from './_schema.js';
import { branches } from './branches.js';
import { users } from './users.js';
import { transactions } from './transactions.js';
import { products } from './products.js';

export const ownerPriceOverrides = petshop.table('owner_price_overrides', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  overrideById: integer('override_by_id').references(() => users.id).notNull(), // Owner/Manager who entered PIN
  originalPrice: decimal('original_price', { precision: 12, scale: 2 }).notNull(),
  overriddenPrice: decimal('overridden_price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const voidRequests = petshop.table('void_requests', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  requestById: integer('request_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = petshop.table('audit_logs', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  tableName: varchar('table_name', { length: 50 }),
  recordId: integer('record_id'),
  oldData: text('old_data'), // JSON string
  newData: text('new_data'), // JSON string
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
